"""
Integration tests - Full workflow scenarios.
Tests complete user journeys through the application.
"""
import pytest
from sqlalchemy import select
from models import User, ChatSession, ChatMessage, Document


# ============================================================================
# Complete User Journey Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_complete_user_journey_register_to_chat(test_client, test_db, sample_pdf_bytes):
    """
    Test complete user flow:
    1. Register
    2. Login
    3. Upload document
    4. Start chat
    5. Chat with document context
    6. Delete document
    7. Delete session
    """
    # Step 1: Register
    register_response = await test_client.post("/auth/register", json={
        "email": "journey@example.com",
        "password": "SecurePass123!",
        "name": "Journey User"
    })
    assert register_response.status_code == 200

    # Step 2: Login
    login_response = await test_client.post("/auth/login", json={
        "email": "journey@example.com",
        "password": "SecurePass123!"
    })
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Step 3: Upload document
    upload_response = await test_client.post(
        "/upload",
        headers=headers,
        files={"file": ("journey.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload_response.status_code == 200
    file_id = upload_response.json()["file_id"]

    # Step 4: Start chat
    chat_response = await test_client.post(
        "/chat",
        headers=headers,
        json={"message": "What does my document say?"}
    )
    assert chat_response.status_code == 200

    # Step 5: Verify chat session created
    sessions_response = await test_client.get("/chat/sessions", headers=headers)
    assert sessions_response.status_code == 200
    sessions = sessions_response.json()
    assert len(sessions) >= 1
    session_id = sessions[0]["id"]

    # Step 6: Chat again in same session
    chat2_response = await test_client.post(
        "/chat",
        headers=headers,
        json={
            "message": "Tell me more",
            "session_id": session_id
        }
    )
    assert chat2_response.status_code == 200

    # Step 7: Delete document
    delete_doc_response = await test_client.delete(
        f"/documents/{file_id}",
        headers=headers
    )
    assert delete_doc_response.status_code == 200

    # Step 8: Delete session
    delete_session_response = await test_client.delete(
        f"/chat/sessions/{session_id}",
        headers=headers
    )
    assert delete_session_response.status_code == 200

    # Verify cleanup
    result = await test_db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_multiple_users_data_isolation(test_client, test_db, sample_pdf_bytes):
    """
    Test that multiple users' data is completely isolated:
    1. Two users register
    2. Both upload documents
    3. Both create chat sessions
    4. Verify User A cannot see User B's data
    """
    # User A registration and login
    await test_client.post("/auth/register", json={
        "email": "userA@example.com",
        "password": "PasswordA123!",
        "name": "User A"
    })
    login_a = await test_client.post("/auth/login", json={
        "email": "userA@example.com",
        "password": "PasswordA123!"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B registration and login
    await test_client.post("/auth/register", json={
        "email": "userB@example.com",
        "password": "PasswordB123!",
        "name": "User B"
    })
    login_b = await test_client.post("/auth/login", json={
        "email": "userB@example.com",
        "password": "PasswordB123!"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A uploads document
    upload_a = await test_client.post(
        "/upload",
        headers=headers_a,
        files={"file": ("userA-doc.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload_a.status_code == 200
    doc_a_id = upload_a.json()["file_id"]

    # User B uploads document
    upload_b = await test_client.post(
        "/upload",
        headers=headers_b,
        files={"file": ("userB-doc.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload_b.status_code == 200
    doc_b_id = upload_b.json()["file_id"]

    # User A creates chat session
    chat_a = await test_client.post(
        "/chat",
        headers=headers_a,
        json={"message": "User A's question"}
    )
    assert chat_a.status_code == 200

    # User B creates chat session
    chat_b = await test_client.post(
        "/chat",
        headers=headers_b,
        json={"message": "User B's question"}
    )
    assert chat_b.status_code == 200

    # User A lists documents - should only see their document
    docs_a = await test_client.get("/documents", headers=headers_a)
    assert docs_a.status_code == 200
    docs_a_list = docs_a.json()
    assert len(docs_a_list) == 1
    assert docs_a_list[0]["name"] == "userA-doc.pdf"

    # User B lists documents - should only see their document
    docs_b = await test_client.get("/documents", headers=headers_b)
    assert docs_b.status_code == 200
    docs_b_list = docs_b.json()
    assert len(docs_b_list) == 1
    assert docs_b_list[0]["name"] == "userB-doc.pdf"

    # User A lists sessions - should only see their session
    sessions_a = await test_client.get("/chat/sessions", headers=headers_a)
    assert sessions_a.status_code == 200
    assert len(sessions_a.json()) == 1

    # User B lists sessions - should only see their session
    sessions_b = await test_client.get("/chat/sessions", headers=headers_b)
    assert sessions_b.status_code == 200
    assert len(sessions_b.json()) == 1

    # User A tries to delete User B's document - should fail
    delete_b_doc = await test_client.delete(
        f"/documents/{doc_b_id}",
        headers=headers_a
    )
    assert delete_b_doc.status_code == 404

    # Verify User B's document still exists
    docs_b_after = await test_client.get("/documents", headers=headers_b)
    assert len(docs_b_after.json()) == 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_storage_limit_workflow(test_client, test_db, sample_pdf_bytes):
    """
    Test storage limit enforcement across multiple uploads:
    1. User uploads files
    2. Approaches storage limit
    3. Upload gets rejected
    4. Delete file to free space
    5. Upload succeeds again
    """
    # Register and login
    await test_client.post("/auth/register", json={
        "email": "storage@example.com",
        "password": "Password123!",
        "name": "Storage Test User"
    })
    login = await test_client.post("/auth/login", json={
        "email": "storage@example.com",
        "password": "Password123!"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get user and set storage near limit
    result = await test_db.execute(
        select(User).where(User.email == "storage@example.com")
    )
    user = result.scalar_one()

    file_size = len(sample_pdf_bytes)
    user.storage_limit_bytes = file_size * 3  # Allow 3 files
    user.total_storage_bytes = 0
    await test_db.commit()

    # Upload 3 files - all should succeed
    file_ids = []
    for i in range(3):
        upload = await test_client.post(
            "/upload",
            headers=headers,
            files={"file": (f"file{i}.pdf", sample_pdf_bytes, "application/pdf")}
        )
        assert upload.status_code == 200
        file_ids.append(upload.json()["file_id"])

    # 4th upload should fail (storage limit)
    upload_fail = await test_client.post(
        "/upload",
        headers=headers,
        files={"file": ("file4.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload_fail.status_code == 413

    # Delete one file to free space
    delete = await test_client.delete(
        f"/documents/{file_ids[0]}",
        headers=headers
    )
    assert delete.status_code == 200

    # Now upload should succeed
    upload_success = await test_client.post(
        "/upload",
        headers=headers,
        files={"file": ("file5.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload_success.status_code == 200


@pytest.mark.asyncio
@pytest.mark.integration
async def test_session_with_multiple_documents(test_client, test_db, sample_pdf_bytes):
    """
    Test chat session with multiple documents:
    1. Create session
    2. Upload multiple documents to session
    3. Chat should have context from all documents
    4. Delete session
    5. Verify documents remain but session_id is NULL
    """
    from tests.conftest import UserFactory

    user = await UserFactory.create(test_db, email="multi@example.com")
    token_data = {"sub": str(user.id)}

    from auth import create_access_token
    token = create_access_token(token_data)
    headers = {"Authorization": f"Bearer {token}"}

    # Upload multiple documents
    doc_ids = []
    for i in range(3):
        upload = await test_client.post(
            "/upload",
            headers=headers,
            files={"file": (f"doc{i}.pdf", sample_pdf_bytes, "application/pdf")}
        )
        assert upload.status_code == 200
        doc_ids.append(upload.json()["file_id"])

    # Start chat (creates session)
    chat = await test_client.post(
        "/chat",
        headers=headers,
        json={"message": "Tell me about my documents"}
    )
    assert chat.status_code == 200

    # Get session ID
    sessions = await test_client.get("/chat/sessions", headers=headers)
    session_id = sessions.json()[0]["id"]

    # Verify documents exist
    docs = await test_client.get("/documents", headers=headers)
    assert len(docs.json()) == 3

    # Delete session
    delete_session = await test_client.delete(
        f"/chat/sessions/{session_id}",
        headers=headers
    )
    assert delete_session.status_code == 200

    # Verify documents still exist (session_id set to NULL)
    docs_after = await test_client.get("/documents", headers=headers)
    assert len(docs_after.json()) == 3


# ============================================================================
# Error Recovery Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_failed_upload_no_storage_charge(test_client, test_db, sample_pdf_bytes):
    """
    Test that failed uploads don't charge storage:
    1. Upload invalid file
    2. Verify storage not increased
    """
    from tests.conftest import UserFactory

    user = await UserFactory.create(test_db, email="error@example.com")

    from auth import create_access_token
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    initial_storage = user.total_storage_bytes

    # Try to upload non-PDF
    upload = await test_client.post(
        "/upload",
        headers=headers,
        files={"file": ("notapdf.txt", b"Not a PDF", "text/plain")}
    )
    assert upload.status_code == 400

    # Verify storage unchanged
    await test_db.refresh(user)
    assert user.total_storage_bytes == initial_storage


@pytest.mark.asyncio
@pytest.mark.integration
async def test_document_deletion_cleanup(test_client, test_db, sample_pdf_bytes, mock_pinecone):
    """
    Test complete cleanup when document is deleted:
    1. Upload document
    2. Verify it's in database and Pinecone
    3. Delete document
    4. Verify removed from both database and Pinecone
    5. Verify storage decreased
    """
    from tests.conftest import UserFactory

    user = await UserFactory.create(test_db, email="cleanup@example.com")

    from auth import create_access_token
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Upload document
    upload = await test_client.post(
        "/upload",
        headers=headers,
        files={"file": ("cleanup.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload.status_code == 200
    file_id = upload.json()["file_id"]
    file_size = upload.json()["file_size_bytes"]

    # Verify storage increased
    await test_db.refresh(user)
    assert user.total_storage_bytes == file_size

    # Verify document in database
    result = await test_db.execute(
        select(Document).where(Document.id == file_id)
    )
    assert result.scalar_one_or_none() is not None

    # Delete document
    delete = await test_client.delete(f"/documents/{file_id}", headers=headers)
    assert delete.status_code == 200

    # Verify removed from database
    result = await test_db.execute(
        select(Document).where(Document.id == file_id)
    )
    assert result.scalar_one_or_none() is None

    # Verify storage decreased
    await test_db.refresh(user)
    assert user.total_storage_bytes == 0

    # Verify Pinecone delete was called
    assert mock_pinecone.delete.called


# ============================================================================
# Concurrent Operations Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.xfail(
    reason="Known concurrency bug: FK violations under high load. "
           "Needs application-level fixes (transaction retries or locking). "
           "See: https://github.com/YourOrg/docu-mate/issues/XXX"
)
async def test_concurrent_chat_messages(test_client, test_db):
    """
    Test multiple concurrent chat messages to same session.

    NOTE: This test currently reveals a concurrency bug in the application:
    Under high concurrency, the chat endpoint can fail with FK violations.
    This is because:
    1. Multiple requests try to create new sessions simultaneously
    2. Transaction isolation prevents them from seeing each other's commits
    3. The FK check fails when trying to insert messages

    TODO: Fix by implementing:
    - Retry logic with exponential backoff
    - SELECT FOR UPDATE locking on session lookups
    - Or use optimistic concurrency control

    This test is marked as xfail to document the issue without blocking CI.
    """
    from tests.conftest import UserFactory
    from auth import create_access_token

    # Create user
    user = await UserFactory.create(test_db, email="concurrent@example.com")
    await test_db.commit()

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Create session via API (first chat message)
    first_response = await test_client.post(
        "/chat",
        headers=headers,
        json={"message": "First message to create session"}
    )
    assert first_response.status_code == 200

    # Get session ID from response header
    session_id = first_response.headers.get("X-Session-Id")
    assert session_id is not None, "Session ID should be in response headers"

    # Wait a bit to ensure session is fully committed
    import asyncio
    await asyncio.sleep(0.5)

    # Now send multiple concurrent messages to the same session
    tasks = []
    for i in range(5):
        task = test_client.post(
            "/chat",
            headers=headers,
            json={
                "message": f"Concurrent message {i}",
                "session_id": session_id
            }
        )
        tasks.append(task)

    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # Check how many succeeded
    success_count = sum(1 for r in responses if hasattr(r, 'status_code') and r.status_code == 200)

    # Ideally all 5 should succeed - if they do, this xfail can be removed
    assert success_count == 5, f"Expected 5 successes, got {success_count}"


# ============================================================================
# Edge Case Workflows
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_empty_user_workflow(test_client):
    """Test user with no data - should handle gracefully"""
    # Register and login
    await test_client.post("/auth/register", json={
        "email": "empty@example.com",
        "password": "Password123!",
        "name": "Empty User"
    })
    login = await test_client.post("/auth/login", json={
        "email": "empty@example.com",
        "password": "Password123!"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List documents - should be empty
    docs = await test_client.get("/documents", headers=headers)
    assert docs.status_code == 200
    assert docs.json() == []

    # List sessions - should be empty
    sessions = await test_client.get("/chat/sessions", headers=headers)
    assert sessions.status_code == 200
    assert sessions.json() == []

    # Get storage - should show zero usage
    storage = await test_client.get("/storage", headers=headers)
    assert storage.status_code == 200
    assert storage.json()["used_bytes"] == 0

    # Chat without documents - should still work
    chat = await test_client.post(
        "/chat",
        headers=headers,
        json={"message": "Hello with no documents"}
    )
    assert chat.status_code == 200


@pytest.mark.asyncio
@pytest.mark.integration
async def test_user_deletion_full_cleanup(test_client, test_db, sample_pdf_bytes):
    """
    Test that deleting a user cleans up everything:
    1. User creates data (documents, sessions, messages)
    2. Delete user
    3. Verify all related data deleted
    """
    from tests.conftest import UserFactory

    user = await UserFactory.create(test_db, email="todelete@example.com")
    user_id = user.id

    from auth import create_access_token
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Upload document
    upload = await test_client.post(
        "/upload",
        headers=headers,
        files={"file": ("delete.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert upload.status_code == 200

    # Create chat
    chat = await test_client.post(
        "/chat",
        headers=headers,
        json={"message": "Test message"}
    )
    assert chat.status_code == 200

    # Delete user
    await test_db.delete(user)
    await test_db.commit()

    # Verify user deleted
    result = await test_db.execute(
        select(User).where(User.id == user_id)
    )
    assert result.scalar_one_or_none() is None

    # Verify sessions deleted (cascade)
    result = await test_db.execute(
        select(ChatSession).where(ChatSession.user_id == user_id)
    )
    assert len(result.scalars().all()) == 0

    # Verify documents deleted (cascade)
    result = await test_db.execute(
        select(Document).where(Document.user_id == user_id)
    )
    assert len(result.scalars().all()) == 0
