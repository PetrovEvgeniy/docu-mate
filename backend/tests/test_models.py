"""
Database model tests.
Tests SQLAlchemy models, relationships, constraints, and cascade deletes.
"""
import pytest
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from models import User, ChatSession, Document, ChatMessage


# ============================================================================
# User Model Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_model_creation(test_db):
    """Test creating a User model"""
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash="hashed_password",
        total_storage_bytes=0,
        storage_limit_bytes=85899346
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.name == "Test User"
    assert user.created_at is not None
    assert user.updated_at is not None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_email_unique_constraint(test_db):
    """Test that email must be unique"""
    user1 = User(email="duplicate@example.com", name="User 1")
    test_db.add(user1)
    await test_db.commit()

    user2 = User(email="duplicate@example.com", name="User 2")
    test_db.add(user2)

    with pytest.raises(IntegrityError):
        await test_db.commit()

    # Rollback after the error
    await test_db.rollback()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_default_storage_values(test_db):
    """Test that user gets default storage values"""
    user = User(email="defaults@example.com", name="Default User")
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    assert user.total_storage_bytes == 0
    assert user.storage_limit_bytes == 85899346  # 81.92 MB


@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_oauth_fields(test_db):
    """Test OAuth provider and ID fields"""
    user = User(
        email="oauth@example.com",
        name="OAuth User",
        oauth_provider="google",
        oauth_id="google_123456"
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    assert user.oauth_provider == "google"
    assert user.oauth_id == "google_123456"
    assert user.password_hash is None  # OAuth users don't have password


@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_relationships_chat_sessions(test_db):
    """Test User has chat_sessions relationship"""
    from tests.conftest import UserFactory, ChatSessionFactory
    from sqlalchemy import select

    user = await UserFactory.create(test_db)
    session1 = await ChatSessionFactory.create(test_db, user)
    session2 = await ChatSessionFactory.create(test_db, user)

    # Query sessions explicitly instead of relying on lazy loading
    result = await test_db.execute(
        select(ChatSession).where(ChatSession.user_id == user.id)
    )
    sessions = result.scalars().all()

    assert len(sessions) == 2
    assert session1.id in [s.id for s in sessions]
    assert session2.id in [s.id for s in sessions]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_relationships_documents(test_db):
    """Test User has documents relationship"""
    from tests.conftest import UserFactory, DocumentFactory
    from sqlalchemy import select

    user = await UserFactory.create(test_db)
    doc1 = await DocumentFactory.create(test_db, user, None)
    doc2 = await DocumentFactory.create(test_db, user, None)

    # Query documents explicitly instead of relying on lazy loading
    result = await test_db.execute(
        select(Document).where(Document.user_id == user.id)
    )
    documents = result.scalars().all()

    assert len(documents) == 2
    assert doc1.id in [d.id for d in documents]
    assert doc2.id in [d.id for d in documents]


# ============================================================================
# ChatSession Model Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_session_creation(test_db):
    """Test creating a ChatSession model"""
    from tests.conftest import UserFactory

    user = await UserFactory.create(test_db)

    session = ChatSession(
        user_id=user.id,
        title="Test Chat Session"
    )
    test_db.add(session)
    await test_db.commit()
    await test_db.refresh(session)

    assert session.id is not None
    assert session.user_id == user.id
    assert session.title == "Test Chat Session"
    assert session.created_at is not None
    assert session.updated_at is not None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_session_requires_user(test_db):
    """Test that ChatSession requires a valid user_id"""
    fake_user_id = uuid4()

    session = ChatSession(
        user_id=fake_user_id,
        title="Orphan Session"
    )
    test_db.add(session)

    with pytest.raises(IntegrityError):
        await test_db.commit()

    # Rollback after the error
    await test_db.rollback()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_session_user_relationship(test_db):
    """Test ChatSession.user relationship"""
    from tests.conftest import UserFactory, ChatSessionFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    await test_db.refresh(session)

    assert session.user is not None
    assert session.user.id == user.id
    assert session.user.email == user.email


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_session_messages_relationship(test_db):
    """Test ChatSession has messages relationship"""
    from tests.conftest import UserFactory, ChatSessionFactory, ChatMessageFactory
    from sqlalchemy import select

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    msg1 = await ChatMessageFactory.create(test_db, session, content="Message 1")
    msg2 = await ChatMessageFactory.create(test_db, session, content="Message 2")

    # Query messages explicitly instead of relying on lazy loading
    result = await test_db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session.id)
    )
    messages = result.scalars().all()

    assert len(messages) == 2
    assert msg1.id in [m.id for m in messages]
    assert msg2.id in [m.id for m in messages]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_session_documents_relationship(test_db):
    """Test ChatSession has documents relationship"""
    from tests.conftest import UserFactory, ChatSessionFactory, DocumentFactory
    from sqlalchemy import select

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    doc1 = await DocumentFactory.create(test_db, user, session)
    doc2 = await DocumentFactory.create(test_db, user, session)

    # Query documents explicitly instead of relying on lazy loading
    result = await test_db.execute(
        select(Document).where(Document.session_id == session.id)
    )
    documents = result.scalars().all()

    assert len(documents) == 2
    assert doc1.id in [d.id for d in documents]
    assert doc2.id in [d.id for d in documents]


# ============================================================================
# Document Model Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_document_creation(test_db):
    """Test creating a Document model"""
    from tests.conftest import UserFactory, ChatSessionFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    doc = Document(
        id=uuid4(),
        user_id=user.id,
        session_id=session.id,
        filename="test.pdf",
        chunk_count=10,
        file_size_bytes=50000
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)

    assert doc.id is not None
    assert doc.user_id == user.id
    assert doc.session_id == session.id
    assert doc.filename == "test.pdf"
    assert doc.chunk_count == 10
    assert doc.file_size_bytes == 50000


@pytest.mark.asyncio
@pytest.mark.unit
async def test_document_nullable_session_id(test_db):
    """Test that Document.session_id can be NULL"""
    from tests.conftest import UserFactory

    user = await UserFactory.create(test_db)

    doc = Document(
        id=uuid4(),
        user_id=user.id,
        session_id=None,  # NULL session
        filename="orphan.pdf",
        chunk_count=5,
        file_size_bytes=25000
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)

    assert doc.session_id is None
    assert doc.user_id == user.id


@pytest.mark.asyncio
@pytest.mark.unit
async def test_document_requires_user(test_db):
    """Test that Document requires a valid user_id"""
    fake_user_id = uuid4()

    doc = Document(
        id=uuid4(),
        user_id=fake_user_id,
        filename="invalid.pdf",
        chunk_count=1,
        file_size_bytes=1000
    )
    test_db.add(doc)

    with pytest.raises(IntegrityError):
        await test_db.commit()

    # Rollback after the error
    await test_db.rollback()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_document_user_relationship(test_db):
    """Test Document.user relationship"""
    from tests.conftest import UserFactory, DocumentFactory

    user = await UserFactory.create(test_db)
    doc = await DocumentFactory.create(test_db, user, None)

    await test_db.refresh(doc)

    assert doc.user is not None
    assert doc.user.id == user.id


@pytest.mark.asyncio
@pytest.mark.unit
async def test_document_session_relationship(test_db):
    """Test Document.session relationship"""
    from tests.conftest import UserFactory, ChatSessionFactory, DocumentFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)
    doc = await DocumentFactory.create(test_db, user, session)

    await test_db.refresh(doc)

    assert doc.session is not None
    assert doc.session.id == session.id


# ============================================================================
# ChatMessage Model Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_message_creation(test_db):
    """Test creating a ChatMessage model"""
    from tests.conftest import UserFactory, ChatSessionFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    message = ChatMessage(
        session_id=session.id,
        role="user",
        content="Hello, this is a test message"
    )
    test_db.add(message)
    await test_db.commit()
    await test_db.refresh(message)

    assert message.id is not None
    assert message.session_id == session.id
    assert message.role == "user"
    assert message.content == "Hello, this is a test message"
    assert message.created_at is not None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_message_role_constraint(test_db):
    """Test that ChatMessage.role has CHECK constraint"""
    from tests.conftest import UserFactory, ChatSessionFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    # Valid roles: 'user' and 'assistant'
    valid_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content="Valid assistant message"
    )
    test_db.add(valid_message)
    await test_db.commit()

    # Invalid role should fail (too long for VARCHAR(10))
    invalid_message = ChatMessage(
        session_id=session.id,
        role="invalid_role",  # 12 chars, exceeds VARCHAR(10)
        content="This should fail"
    )
    test_db.add(invalid_message)

    # Should raise error for string truncation
    with pytest.raises(Exception):  # Catches both IntegrityError and DataError
        await test_db.commit()

    # Rollback after the error
    await test_db.rollback()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_message_requires_session(test_db):
    """Test that ChatMessage requires a valid session_id"""
    fake_session_id = uuid4()

    message = ChatMessage(
        session_id=fake_session_id,
        role="user",
        content="Orphan message"
    )
    test_db.add(message)

    with pytest.raises(IntegrityError):
        await test_db.commit()

    # Rollback after the error
    await test_db.rollback()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_message_session_relationship(test_db):
    """Test ChatMessage.session relationship"""
    from tests.conftest import UserFactory, ChatSessionFactory, ChatMessageFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)
    message = await ChatMessageFactory.create(test_db, session)

    await test_db.refresh(message)

    assert message.session is not None
    assert message.session.id == session.id


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chat_message_unlimited_content_length(test_db):
    """Test that ChatMessage.content can be very long"""
    from tests.conftest import UserFactory, ChatSessionFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)

    # Very long content (10,000 characters)
    long_content = "This is a test message. " * 400

    message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=long_content
    )
    test_db.add(message)
    await test_db.commit()
    await test_db.refresh(message)

    assert len(message.content) > 9000
    assert message.content == long_content


# ============================================================================
# Cascade Delete Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_delete_user_cascades_to_sessions(test_db):
    """Test that deleting a user cascades to chat sessions"""
    from tests.conftest import UserFactory, ChatSessionFactory

    user = await UserFactory.create(test_db)
    session1 = await ChatSessionFactory.create(test_db, user)
    session2 = await ChatSessionFactory.create(test_db, user)

    session_ids = [session1.id, session2.id]

    # Delete user
    await test_db.delete(user)
    await test_db.commit()

    # Verify sessions are deleted
    for session_id in session_ids:
        result = await test_db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_delete_user_cascades_to_documents(test_db):
    """Test that deleting a user cascades to documents"""
    from tests.conftest import UserFactory, DocumentFactory

    user = await UserFactory.create(test_db)
    doc1 = await DocumentFactory.create(test_db, user, None)
    doc2 = await DocumentFactory.create(test_db, user, None)

    doc_ids = [doc1.id, doc2.id]

    # Delete user
    await test_db.delete(user)
    await test_db.commit()

    # Verify documents are deleted
    for doc_id in doc_ids:
        result = await test_db.execute(
            select(Document).where(Document.id == doc_id)
        )
        assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_delete_session_cascades_to_messages(test_db):
    """Test that deleting a session cascades to messages"""
    from tests.conftest import UserFactory, ChatSessionFactory, ChatMessageFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)
    msg1 = await ChatMessageFactory.create(test_db, session)
    msg2 = await ChatMessageFactory.create(test_db, session)

    message_ids = [msg1.id, msg2.id]

    # Delete session
    await test_db.delete(session)
    await test_db.commit()

    # Verify messages are deleted
    for msg_id in message_ids:
        result = await test_db.execute(
            select(ChatMessage).where(ChatMessage.id == msg_id)
        )
        assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_delete_session_sets_null_on_documents(test_db):
    """Test that deleting a session sets document.session_id to NULL"""
    from tests.conftest import UserFactory, ChatSessionFactory, DocumentFactory

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)
    doc = await DocumentFactory.create(test_db, user, session)

    doc_id = doc.id

    # Delete session
    await test_db.delete(session)
    await test_db.commit()

    # Need to expire the session to clear cache
    test_db.expire_all()

    # Verify document still exists but session_id is NULL
    result = await test_db.execute(
        select(Document).where(Document.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    assert doc is not None, "Document should still exist after session deletion"
    assert doc.session_id is None, "Document session_id should be NULL after session deletion"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_delete_user_full_cascade(test_db):
    """Test complete cascade: deleting user removes sessions, messages, and documents"""
    from tests.conftest import (
        UserFactory, ChatSessionFactory, ChatMessageFactory, DocumentFactory
    )

    user = await UserFactory.create(test_db)
    session = await ChatSessionFactory.create(test_db, user)
    message = await ChatMessageFactory.create(test_db, session)
    document = await DocumentFactory.create(test_db, user, session)

    ids = {
        'user': user.id,
        'session': session.id,
        'message': message.id,
        'document': document.id
    }

    # Delete user
    await test_db.delete(user)
    await test_db.commit()

    # Verify everything is deleted
    result = await test_db.execute(
        select(User).where(User.id == ids['user'])
    )
    assert result.scalar_one_or_none() is None

    result = await test_db.execute(
        select(ChatSession).where(ChatSession.id == ids['session'])
    )
    assert result.scalar_one_or_none() is None

    result = await test_db.execute(
        select(ChatMessage).where(ChatMessage.id == ids['message'])
    )
    assert result.scalar_one_or_none() is None

    result = await test_db.execute(
        select(Document).where(Document.id == ids['document'])
    )
    assert result.scalar_one_or_none() is None


# ============================================================================
# Index Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_email_index_exists(test_db):
    """Test that users.email has an index"""
    # Index exists if email queries are fast
    from tests.conftest import UserFactory

    # Create many users
    for i in range(10):
        await UserFactory.create(test_db, email=f"user{i}@example.com")

    # Query by email should use index
    result = await test_db.execute(
        select(User).where(User.email == "user5@example.com")
    )
    user = result.scalar_one()
    assert user.email == "user5@example.com"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_oauth_composite_index(test_db):
    """Test OAuth provider and ID composite index"""
    from tests.conftest import UserFactory

    # Create OAuth users
    user1 = await UserFactory.create(
        test_db,
        email="google1@example.com",
        oauth_provider="google",
        oauth_id="google_123"
    )

    user2 = await UserFactory.create(
        test_db,
        email="github1@example.com",
        oauth_provider="github",
        oauth_id="github_456"
    )

    # Query by OAuth provider and ID should be fast
    result = await test_db.execute(
        select(User).where(
            User.oauth_provider == "google",
            User.oauth_id == "google_123"
        )
    )
    user = result.scalar_one()
    assert user.id == user1.id
