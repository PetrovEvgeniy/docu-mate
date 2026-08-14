import os
import tempfile
import uuid
import asyncio
import warnings
from datetime import timedelta
from typing import Optional

# Suppress bcrypt version warning (cosmetic only, passlib handles it)
warnings.filterwarnings("ignore", message=".*bcrypt.*__about__.*")

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, FileResponse
from pydantic import BaseModel, EmailStr, field_validator
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

# LangChain Imports
from pypdf import PdfReader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from pinecone import Pinecone
from langchain_core.messages import HumanMessage, SystemMessage

from pinecone import Pinecone

# Local imports
from database import get_db
from models import User, ChatSession, Document as DBDocument, ChatMessage
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_user_by_email,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# Load environment variables
load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not all([PINECONE_API_KEY, PINECONE_INDEX_NAME, GEMINI_API_KEY]):
    print("Warning: Missing required environment variables. Please check your .env file.")

# Initialize FastAPI app
app = FastAPI(title="DocuMate AI API")

@app.on_event("startup")
async def startup_event():
    """Run database migrations on startup"""
    try:
        from alembic.config import Config
        from alembic import command
        import logging

        logging.info("Running database migrations...")
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logging.info("Database migrations completed successfully!")
    except Exception as e:
        logging.error(f"Migration failed: {e}")
        # Don't fail startup if migrations fail (tables might already exist)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://docu-mate-frontend-368729308066.us-central1.run.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],  # Expose custom header for frontend to read
)

# Initialize AI Services
embeddings = None
vector_store = None
llm = None
pinecone_index = None

if PINECONE_API_KEY and GEMINI_API_KEY:
    try:
        embeddings = GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-2-preview",
            google_api_key=GEMINI_API_KEY
        )

        # Initialize Pinecone client for direct operations
        pc = Pinecone(api_key=PINECONE_API_KEY)
        pinecone_index = pc.Index(PINECONE_INDEX_NAME)

        # Import PineconeVectorStore here to avoid issues
        from langchain_pinecone import PineconeVectorStore
        vector_store = PineconeVectorStore(
            index_name=PINECONE_INDEX_NAME,
            embedding=embeddings,
            pinecone_api_key=PINECONE_API_KEY
        )
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            streaming=True,
            google_api_key=GEMINI_API_KEY
        )
        print("AI Services successfully initialized!")
    except Exception as e:
        import traceback
        print(f"Error initializing AI services: {e}")
        traceback.print_exc()
else:
    print("Warning: Missing required environment variables (PINECONE_API_KEY or GEMINI_API_KEY).")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "DocuMate AI API is running"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    file_path = os.path.join(os.path.dirname(__file__), "favicon.ico")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/x-icon")
    return Response(status_code=204)

# ==================== Authentication Endpoints ====================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Password cannot be empty')
        if len(v) > 72:  # bcrypt limit
            raise ValueError('Password too long (max 72 characters)')
        return v

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@app.post("/auth/register", response_model=dict)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with email/password"""
    # Check if user already exists
    existing_user = await get_user_by_email(db, request.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    hashed_pw = hash_password(request.password)
    new_user = User(
        email=request.email,
        name=request.name,
        password_hash=hashed_pw
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "name": new_user.name
    }

@app.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email/password and receive JWT token"""
    user = await get_user_by_email(db, request.email)

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name
        }
    }

class OAuthLoginRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    oauth_provider: str  # "google" or "github"
    oauth_id: str

@app.post("/auth/oauth", response_model=TokenResponse)
async def oauth_login(request: OAuthLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login or register user via OAuth (Google/GitHub)"""
    # Try to find existing user by email
    user = await get_user_by_email(db, request.email)

    if not user:
        # Create new user for OAuth
        user = User(
            email=request.email,
            name=request.name or request.email.split('@')[0],
            oauth_provider=request.oauth_provider,
            oauth_id=request.oauth_id,
            password_hash=None  # OAuth users don't have passwords
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update OAuth info if user exists
        if not user.oauth_provider:
            user.oauth_provider = request.oauth_provider
            user.oauth_id = request.oauth_id
            await db.commit()
            await db.refresh(user)

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "total_storage_bytes": user.total_storage_bytes,
            "storage_limit_bytes": user.storage_limit_bytes
        }
    }

@app.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "total_storage_bytes": current_user.total_storage_bytes,
        "storage_limit_bytes": current_user.storage_limit_bytes
    }

# ==================== Upload Endpoint (Updated) ====================

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint to handle document uploads, parse text, chunk, and embed to Pinecone.
    Documents belong to users (session_id is optional for future filtering).
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported currently.")

    if not vector_store:
        raise HTTPException(status_code=500, detail="Vector store is not initialized properly.")

    try:
        # Verify session belongs to user (if provided)
        session = None
        if session_id:
            result = await db.execute(
                select(ChatSession).where(ChatSession.id == uuid.UUID(session_id))
            )
            session = result.scalar_one_or_none()

            if not session or session.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Session not found or unauthorized")

        # Read file and check storage limit
        content = await file.read()
        file_size = len(content)

        if current_user.total_storage_bytes + file_size > current_user.storage_limit_bytes:
            remaining = current_user.storage_limit_bytes - current_user.total_storage_bytes
            raise HTTPException(
                status_code=413,
                detail=f"Storage limit exceeded. You have {remaining / (1024**2):.2f} MB remaining."
            )

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # 1. Load PDF
        reader = PdfReader(tmp_path)
        documents = [
            Document(
                page_content=page.extract_text() or "",
                metadata={"page": i, "source": tmp_path}
            )
            for i, page in enumerate(reader.pages)
        ]

        # 2. Split Text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        chunks = text_splitter.split_documents(documents)

        # 3. Add metadata to chunks (user_id for filtering, session_id optional)
        file_id = str(uuid.uuid4())
        for chunk in chunks:
            chunk.metadata["source_filename"] = file.filename
            chunk.metadata["file_id"] = file_id
            chunk.metadata["user_id"] = str(current_user.id)
            if session:
                chunk.metadata["session_id"] = str(session.id)

        # 4. Embed and Upload to Pinecone
        vector_store.add_documents(chunks)

        # 5. Store document metadata in PostgreSQL
        document = DBDocument(
            id=uuid.UUID(file_id),
            user_id=current_user.id,
            session_id=session.id if session else None,
            filename=file.filename,
            chunk_count=len(chunks),
            file_size_bytes=file_size
        )
        db.add(document)

        # 6. Update user's total storage
        current_user.total_storage_bytes += file_size

        await db.commit()

        # Clean up temp file
        os.remove(tmp_path)

        return {
            "status": "success",
            "filename": file.filename,
            "chunks_processed": len(chunks),
            "file_id": file_id,
            "file_size_bytes": file_size,
            "storage_used": current_user.total_storage_bytes,
            "storage_limit": current_user.storage_limit_bytes
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error during upload: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Chat Endpoint (Updated) ====================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

@app.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint to handle chat queries, retrieve context from Pinecone, and generate an answer using Gemini.
    Messages are saved to the chat session.
    """
    if not vector_store or not llm:
        raise HTTPException(status_code=500, detail="AI Services are not initialized.")

    # Get or create chat session
    if request.session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == uuid.UUID(request.session_id))
        )
        session = result.scalar_one_or_none()
        if not session or session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        # Create new session with first message as title
        session = ChatSession(
            user_id=current_user.id,
            title=request.message[:50] + ("..." if len(request.message) > 50 else "")
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # Save user message to database
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    await db.commit()

    # Vector Search filtered by user_id (all user documents)
    retrieved_docs = vector_store.similarity_search(
        request.message,
        k=4,
        filter={
            "user_id": str(current_user.id)
        }
    )

    # Assemble Context
    context_text = "\n\n---\n\n".join([doc.page_content for doc in retrieved_docs])

    # Prepare Prompt
    system_prompt = f"""You are DocuMate, a helpful assistant. Answer the user's question using ONLY the following context.
If the answer is not in the context, say "I don't have this information in your documents."

Context:
{context_text}
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=request.message)
    ]

    # Stream Response and save assistant message
    async def generate():
        full_response = ""
        async for chunk in llm.astream(messages):
            full_response += chunk.content
            yield chunk.content

        # Save assistant message after streaming completes
        assistant_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=full_response
        )
        db.add(assistant_msg)
        await db.commit()

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "X-Session-Id": str(session.id)  # Return session ID in header
        }
    )

# ==================== Chat Session Endpoints ====================

@app.get("/chat/sessions")
async def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of user's chat sessions"""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()

    return [
        {
            "id": str(session.id),
            "title": session.title,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat()
        }
        for session in sessions
    ]

@app.get("/chat/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all messages in a chat session"""
    # Verify session belongs to user
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == uuid.UUID(session_id))
    )
    session = result.scalar_one_or_none()

    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get messages
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == uuid.UUID(session_id))
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()

    return [
        {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat()
        }
        for msg in messages
    ]

@app.delete("/chat/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat session and all its messages"""
    # Verify session belongs to user
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == uuid.UUID(session_id))
    )
    session = result.scalar_one_or_none()

    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()

    return {"status": "success", "message": "Session deleted"}

# ==================== Document Management Endpoints ====================

@app.get("/documents")
async def list_documents(
    session_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of user's documents, optionally filtered by session"""
    query = select(DBDocument).where(DBDocument.user_id == current_user.id)

    if session_id:
        query = query.where(DBDocument.session_id == uuid.UUID(session_id))

    query = query.order_by(DBDocument.uploaded_at.desc())

    result = await db.execute(query)
    documents = result.scalars().all()

    return [
        {
            "id": str(doc.id),
            "name": doc.filename,
            "file_size_bytes": doc.file_size_bytes,
            "session_id": str(doc.session_id) if doc.session_id else None,
            "uploaded_at": doc.uploaded_at.isoformat()
        }
        for doc in documents
    ]

@app.delete("/documents/{file_id}")
async def delete_document(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a document from both Pinecone and PostgreSQL"""
    # Get document and verify ownership
    result = await db.execute(
        select(DBDocument).where(DBDocument.id == uuid.UUID(file_id))
    )
    document = result.scalar_one_or_none()

    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete vectors from Pinecone using direct client with metadata filtering
    try:
        if pinecone_index:
            # Build filter for Pinecone deletion
            pinecone_filter = {
                "file_id": {"$eq": str(file_id)},
                "user_id": {"$eq": str(current_user.id)}
            }
            # Only add session_id if it exists
            if document.session_id:
                pinecone_filter["session_id"] = {"$eq": str(document.session_id)}

            # Delete all vectors matching the filter
            pinecone_index.delete(filter=pinecone_filter)
            print(f"Deleted vectors from Pinecone for file_id: {file_id}")
        else:
            print("Warning: Pinecone index not initialized")
    except Exception as e:
        print(f"Warning: Error deleting from Pinecone: {e}")
        import traceback
        traceback.print_exc()

    # Update user's total storage
    current_user.total_storage_bytes -= document.file_size_bytes

    # Delete from PostgreSQL
    await db.delete(document)
    await db.commit()

    return {
        "status": "success",
        "storage_used": current_user.total_storage_bytes,
        "storage_limit": current_user.storage_limit_bytes
    }

@app.get("/storage")
async def get_storage_info(current_user: User = Depends(get_current_user)):
    """Get current user's storage usage information"""
    return {
        "used_bytes": current_user.total_storage_bytes,
        "limit_bytes": current_user.storage_limit_bytes,
        "used_mb": current_user.total_storage_bytes / (1024**2),
        "limit_mb": current_user.storage_limit_bytes / (1024**2),
        "percentage_used": (current_user.total_storage_bytes / current_user.storage_limit_bytes) * 100 if current_user.storage_limit_bytes > 0 else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
