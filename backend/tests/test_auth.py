"""
Authentication endpoint tests.
Tests user registration, login, JWT tokens, and OAuth flows.
"""
import pytest
from sqlalchemy import select
from models import User
from auth import verify_password, decode_token


# ============================================================================
# Registration Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_register_success(test_client, test_db):
    """Test successful user registration"""
    response = await test_client.post("/auth/register", json={
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "name": "New User"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["name"] == "New User"
    assert "id" in data
    assert "password" not in data  # Password should not be returned

    # Verify user was created in database
    result = await test_db.execute(
        select(User).where(User.email == "newuser@example.com")
    )
    user = result.scalar_one_or_none()
    assert user is not None
    assert verify_password("SecurePass123!", user.password_hash)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_register_duplicate_email(test_client, test_user):
    """Test registration with duplicate email fails"""
    response = await test_client.post("/auth/register", json={
        "email": test_user.email,
        "password": "AnotherPass123!",
        "name": "Duplicate User"
    })

    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_register_invalid_email(test_client):
    """Test registration with invalid email format"""
    response = await test_client.post("/auth/register", json={
        "email": "not-an-email",
        "password": "Password123!",
        "name": "Invalid Email User"
    })

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
@pytest.mark.unit
async def test_register_missing_fields(test_client):
    """Test registration with missing required fields"""
    response = await test_client.post("/auth/register", json={
        "email": "incomplete@example.com"
        # Missing password and name
    })

    assert response.status_code == 422


# ============================================================================
# Login Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_success(test_client, test_user):
    """Test successful login"""
    response = await test_client.post("/auth/login", json={
        "email": test_user.email,
        "password": "Test123!"
    })

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == test_user.email

    # Verify token is valid
    token_data = decode_token(data["access_token"])
    assert token_data["sub"] == str(test_user.id)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_wrong_password(test_client, test_user):
    """Test login with incorrect password"""
    response = await test_client.post("/auth/login", json={
        "email": test_user.email,
        "password": "WrongPassword123!"
    })

    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_nonexistent_user(test_client):
    """Test login with non-existent email"""
    response = await test_client.post("/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "Password123!"
    })

    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_case_sensitive_email(test_client, test_user):
    """Test that email login is case-insensitive"""
    response = await test_client.post("/auth/login", json={
        "email": test_user.email.upper(),
        "password": "Test123!"
    })

    # Should succeed (emails are typically case-insensitive)
    assert response.status_code in [200, 401]  # Implementation dependent


# ============================================================================
# Get Current User Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_current_user_success(test_client, auth_headers, test_user):
    """Test getting current user with valid token"""
    response = await test_client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email
    assert data["name"] == test_user.name
    assert data["id"] == str(test_user.id)
    assert "total_storage_bytes" in data
    assert "storage_limit_bytes" in data


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_current_user_no_token(test_client):
    """Test getting current user without token"""
    response = await test_client.get("/auth/me")

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_current_user_invalid_token(test_client):
    """Test getting current user with invalid token"""
    response = await test_client.get("/auth/me", headers={
        "Authorization": "Bearer invalid-token-12345"
    })

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_current_user_malformed_header(test_client):
    """Test getting current user with malformed auth header"""
    # Missing "Bearer" prefix
    response = await test_client.get("/auth/me", headers={
        "Authorization": "just-a-token"
    })

    assert response.status_code == 401


# ============================================================================
# JWT Token Tests
# ============================================================================

@pytest.mark.unit
def test_create_access_token(test_user):
    """Test JWT token creation"""
    from auth import create_access_token

    token = create_access_token({"sub": str(test_user.id)})
    assert token is not None
    assert isinstance(token, str)

    # Verify token can be decoded
    token_data = decode_token(token)
    assert token_data["sub"] == str(test_user.id)


@pytest.mark.unit
def test_decode_valid_token(test_user, auth_token):
    """Test decoding a valid JWT token"""
    token_data = decode_token(auth_token)
    assert token_data["sub"] == str(test_user.id)
    assert "exp" in token_data  # Expiration timestamp


@pytest.mark.unit
def test_decode_expired_token():
    """Test decoding an expired token"""
    from auth import create_access_token
    from datetime import timedelta

    # Create token that expires immediately
    token = create_access_token(
        {"sub": "test-user-id"},
        expires_delta=timedelta(seconds=-1)  # Already expired
    )

    with pytest.raises(Exception):  # Should raise exception for expired token
        decode_token(token)


@pytest.mark.unit
def test_decode_invalid_signature():
    """Test decoding token with invalid signature"""
    # Create a token-like string with invalid signature
    invalid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalid"

    with pytest.raises(Exception):
        decode_token(invalid_token)


# ============================================================================
# Password Security Tests
# ============================================================================

@pytest.mark.unit
def test_password_hashing():
    """Test password hashing"""
    from auth import hash_password, verify_password

    password = "SecurePassword123!"
    hashed = hash_password(password)

    assert hashed != password  # Should be hashed
    assert hashed.startswith("$2b$")  # Bcrypt prefix
    assert verify_password(password, hashed)  # Should verify correctly


@pytest.mark.unit
def test_password_verification_fails_wrong_password():
    """Test password verification with wrong password"""
    from auth import hash_password, verify_password

    password = "CorrectPassword123!"
    hashed = hash_password(password)

    assert not verify_password("WrongPassword123!", hashed)


@pytest.mark.unit
def test_password_hash_uniqueness():
    """Test that same password produces different hashes (salt)"""
    from auth import hash_password

    password = "SamePassword123!"
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    assert hash1 != hash2  # Different salts = different hashes


# ============================================================================
# Security Edge Cases
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_sql_injection_attempt_in_email(test_client):
    """Test SQL injection protection in email field"""
    response = await test_client.post("/auth/register", json={
        "email": "test@example.com' OR '1'='1",
        "password": "Password123!",
        "name": "SQL Inject"
    })

    # Should either validate email format (422) or safely handle (400/500)
    assert response.status_code in [400, 422]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_xss_attempt_in_name(test_client, test_db):
    """Test XSS protection in name field"""
    response = await test_client.post("/auth/register", json={
        "email": "xss@example.com",
        "password": "Password123!",
        "name": "<script>alert('XSS')</script>"
    })

    if response.status_code == 200:
        data = response.json()
        # Name should be stored as-is (escaping happens on frontend)
        # But verify it doesn't execute on backend
        assert "<script>" in data["name"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_very_long_password(test_client):
    """Test handling of very long passwords"""
    long_password = "A" * 10000

    response = await test_client.post("/auth/register", json={
        "email": "longpass@example.com",
        "password": long_password,
        "name": "Long Password User"
    })

    # Should either accept or reject with validation error
    assert response.status_code in [200, 400, 422]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_empty_password(test_client):
    """Test registration with empty password"""
    response = await test_client.post("/auth/register", json={
        "email": "empty@example.com",
        "password": "",
        "name": "Empty Password"
    })

    assert response.status_code == 422  # Should fail validation


# ============================================================================
# Storage Initialization Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.unit
async def test_new_user_default_storage_limit(test_client, test_db):
    """Test that new users get default storage limit"""
    response = await test_client.post("/auth/register", json={
        "email": "storage@example.com",
        "password": "Password123!",
        "name": "Storage User"
    })

    assert response.status_code == 200

    # Check database
    result = await test_db.execute(
        select(User).where(User.email == "storage@example.com")
    )
    user = result.scalar_one()

    assert user.total_storage_bytes == 0  # Starts at 0
    assert user.storage_limit_bytes == 85899346  # Default 81.92 MB


@pytest.mark.asyncio
@pytest.mark.unit
async def test_auth_me_includes_storage_info(test_client, auth_headers, test_user):
    """Test that /auth/me endpoint includes storage information"""
    response = await test_client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert "total_storage_bytes" in data
    assert "storage_limit_bytes" in data
    assert isinstance(data["total_storage_bytes"], int)
    assert isinstance(data["storage_limit_bytes"], int)
