"""
Shared pytest fixtures for backend tests.
Provides database, authentication, external service mocks, and test data factories.
"""
import pytest
import asyncio
from uuid import uuid4
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport
from faker import Faker

from database import get_db
from models import Base, User, ChatSession, Document, ChatMessage
from auth import hash_password, create_access_token
from main import app

fake = Faker()

# Database URL for tests (read from environment or use default)
import os
TEST_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/documate_test"
)


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_engine():
    """Create test database engine"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def test_db(test_engine):
    """
    Isolated test database session.
    Truncates tables after each test for isolation.
    """
    async_session = sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session() as session:
        yield session

        # Truncate all tables after test (faster than drop/create)
        await session.execute(text("TRUNCATE users, chat_sessions, documents, chat_messages CASCADE"))
        await session.commit()


# ============================================================================
# Test Data Factories
# ============================================================================

class UserFactory:
    """Generate test users with realistic data"""

    @staticmethod
    async def create(db: AsyncSession, **kwargs):
        """Create a test user"""
        user = User(
            email=kwargs.get('email', fake.email()),
            name=kwargs.get('name', fake.name()),
            password_hash=hash_password(kwargs.get('password', 'Test123!')),
            oauth_provider=kwargs.get('oauth_provider'),
            oauth_id=kwargs.get('oauth_id'),
            total_storage_bytes=kwargs.get('total_storage_bytes', 0),
            storage_limit_bytes=kwargs.get('storage_limit_bytes', 85899346),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user.password = kwargs.get('password', 'Test123!')  # Store for tests
        return user


class ChatSessionFactory:
    """Generate test chat sessions"""

    @staticmethod
    async def create(db: AsyncSession, user: User, **kwargs):
        """Create a test chat session"""
        session = ChatSession(
            user_id=user.id,
            title=kwargs.get('title', fake.sentence(nb_words=3)),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session


class DocumentFactory:
    """Generate test documents"""

    @staticmethod
    async def create(db: AsyncSession, user: User, session: ChatSession = None, **kwargs):
        """Create a test document"""
        doc = Document(
            id=kwargs.get('id', uuid4()),
            user_id=user.id,
            session_id=session.id if session else None,
            filename=kwargs.get('filename', fake.file_name(extension='pdf')),
            chunk_count=kwargs.get('chunk_count', 10),
            file_size_bytes=kwargs.get('file_size_bytes', 50000),
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        return doc


class ChatMessageFactory:
    """Generate test chat messages"""

    @staticmethod
    async def create(db: AsyncSession, session: ChatSession, **kwargs):
        """Create a test chat message"""
        message = ChatMessage(
            session_id=session.id,
            role=kwargs.get('role', 'user'),
            content=kwargs.get('content', fake.sentence()),
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest.fixture
async def test_user(test_db):
    """Standard test user"""
    return await UserFactory.create(
        test_db,
        email="test@example.com",
        password="Test123!"
    )


@pytest.fixture
async def test_user2(test_db):
    """Second test user for isolation tests"""
    return await UserFactory.create(
        test_db,
        email="user2@example.com",
        password="Test123!"
    )


@pytest.fixture
def auth_token(test_user):
    """JWT token for test user"""
    return create_access_token({"sub": str(test_user.id)})


@pytest.fixture
def auth_headers(auth_token):
    """Authorization headers with JWT token"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def auth_token2(test_user2):
    """JWT token for second test user"""
    return create_access_token({"sub": str(test_user2.id)})


@pytest.fixture
def auth_headers2(auth_token2):
    """Authorization headers for second test user"""
    return {"Authorization": f"Bearer {auth_token2}"}


# ============================================================================
# External Service Mocks
# ============================================================================

@pytest.fixture
def mock_pinecone(mocker):
    """Mock Pinecone client to avoid external API calls"""
    mock_index = mocker.Mock()

    # Mock upsert (adding vectors)
    mock_index.upsert = mocker.Mock(return_value={"upserted_count": 10})

    # Mock delete (removing vectors)
    mock_index.delete = mocker.Mock(return_value={"deleted_count": 10})

    # Mock query (vector search)
    mock_index.query = mocker.Mock(return_value={
        "matches": [
            {
                "id": "chunk1",
                "score": 0.95,
                "metadata": {
                    "text": "Sample PDF content for testing.",
                    "source_filename": "test.pdf",
                    "file_id": str(uuid4()),
                }
            },
        ]
    })

    # Patch the global pinecone_index
    mocker.patch('main.pinecone_index', mock_index)

    return mock_index


@pytest.fixture
def mock_gemini(mocker):
    """Mock Google Gemini LLM"""
    mock_llm = mocker.Mock()

    async def mock_astream(messages):
        """Mock streaming response"""
        response = "This is a mock response from Gemini for testing purposes."
        for word in response.split():
            chunk = mocker.Mock()
            chunk.content = word + " "
            yield chunk

    mock_llm.astream = mock_astream

    # Patch the global llm
    mocker.patch('main.llm', mock_llm)

    return mock_llm


@pytest.fixture
def mock_embeddings(mocker):
    """Mock embeddings model"""
    mock_embed = mocker.Mock()

    # Return fake embedding vectors
    mock_embed.embed_documents = mocker.Mock(
        return_value=[[0.1] * 768 for _ in range(10)]
    )

    # Patch the global embeddings
    mocker.patch('main.embeddings', mock_embed)

    return mock_embed


@pytest.fixture
def mock_vector_store(mocker, mock_pinecone, mock_embeddings):
    """Mock the entire vector store"""
    mock_store = mocker.Mock()

    # Mock add_documents (upload)
    mock_store.add_documents = mocker.Mock(return_value=None)

    # Mock similarity_search (retrieval)
    mock_store.similarity_search = mocker.Mock(return_value=[
        mocker.Mock(
            page_content="Sample document content for testing.",
            metadata={
                "source_filename": "test.pdf",
                "file_id": str(uuid4()),
            }
        )
    ])

    # Mock delete (cleanup)
    mock_store.delete = mocker.Mock(return_value=None)

    # Patch the global vector_store
    mocker.patch('main.vector_store', mock_store)

    return mock_store


# ============================================================================
# Test Client Fixture
# ============================================================================

@pytest.fixture
async def test_client(test_db, mock_pinecone, mock_gemini, mock_embeddings, mock_vector_store):
    """
    FastAPI TestClient with all dependencies mocked.
    Uses test database and mocks external services.
    """

    # Override get_db dependency to use test database
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    # Create async client with ASGI transport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Cleanup
    app.dependency_overrides.clear()


# ============================================================================
# Sample PDF Fixture
# ============================================================================

@pytest.fixture
def sample_pdf_bytes():
    """Sample PDF file bytes for upload tests"""
    # Minimal valid PDF (works with pypdf parser)
    pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 55
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF Content for Testing) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
422
%%EOF"""
    return pdf_content


@pytest.fixture
def sample_pdf_file(sample_pdf_bytes):
    """Sample PDF file object for upload tests"""
    from io import BytesIO
    return ("test.pdf", BytesIO(sample_pdf_bytes), "application/pdf")
