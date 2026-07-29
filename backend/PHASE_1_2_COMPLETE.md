# Backend Phase 1 & 2 Implementation Complete

## ✅ Completed Work

### Phase 1: Backend Foundation (Database + Auth)

1. **Dependencies Added** (`requirements.txt`):
   - `sqlalchemy>=2.0.0` - ORM for database operations
   - `asyncpg` - Async PostgreSQL driver
   - `alembic` - Database migrations
   - `passlib[bcrypt]` - Password hashing
   - `python-jose[cryptography]` - JWT token handling
   - `psycopg2-binary` - Sync PostgreSQL driver for Alembic

2. **Database Models** (`models.py`):
   - `User` - User accounts with email/password or OAuth
     - Tracks `total_storage_bytes` and `storage_limit_bytes` (81.92 MB default per user, supporting 25 users on 2GB Pinecone)
   - `ChatSession` - Chat conversations belonging to users
   - `Document` - Uploaded documents scoped to chat sessions
   - `ChatMessage` - Individual messages in chat sessions

3. **Database Connection** (`database.py`):
   - Async SQLAlchemy engine with connection pooling
   - `get_db()` dependency for FastAPI endpoints
   - Helper functions for table management

4. **Authentication Utilities** (`auth.py`):
   - `hash_password()` - Bcrypt password hashing
   - `verify_password()` - Password verification
   - `create_access_token()` - JWT token creation
   - `decode_token()` - JWT validation
   - `get_current_user()` - FastAPI dependency for protected routes
   - Helper functions for user lookups (email, OAuth)

5. **Database Migrations** (Alembic):
   - Configured Alembic for async PostgreSQL
   - Created initial migration: `001_initial_schema.py`
   - Migration creates all tables with proper relationships and indexes

### Phase 2: Backend API Endpoints

All endpoints implemented in `main.py`:

#### Authentication Endpoints
- `POST /auth/register` - Register new user with email/password
- `POST /auth/login` - Login and receive JWT token
- `GET /auth/me` - Get current user info (protected)

#### Upload Endpoint (Updated)
- `POST /upload` - Upload PDF to specific chat session
  - Requires authentication
  - Requires `session_id` parameter
  - Checks storage limits before upload
  - Scopes documents to chat sessions
  - Updates user's total storage usage
  - Stores metadata in PostgreSQL + vectors in Pinecone

#### Chat Endpoint (Updated)
- `POST /chat` - Send message and get AI response
  - Requires authentication
  - Creates or uses existing chat session
  - Saves user and assistant messages to database
  - Filters vector search by `session_id` (session-scoped context)
  - Streams response from Gemini

#### Chat Session Management
- `GET /chat/sessions` - List user's chat sessions
- `GET /chat/sessions/{session_id}/messages` - Get all messages in a session
- `DELETE /chat/sessions/{session_id}` - Delete a session (cascade deletes messages)

#### Document Management
- `GET /documents` - List user's documents (optionally filtered by session)
- `DELETE /documents/{file_id}` - Delete document
  - Removes from Pinecone and PostgreSQL
  - Updates user's storage usage
- `GET /storage` - Get storage usage info

#### CORS Configuration
- Updated to only allow `localhost:3000` and `localhost:3001`

## 🔧 Setup Instructions

### 1. Install PostgreSQL

If PostgreSQL is not installed:

```bash
# macOS with Homebrew
brew install postgresql@16
brew services start postgresql@16
```

### 2. Run Database Setup

```bash
cd backend
./setup_db.sh
```

This script will:
- Check for PostgreSQL
- Create the `documate` database
- Run Alembic migrations

Or manually:

```bash
# Create database
createdb documate

# Run migrations
source venv/bin/activate
alembic upgrade head
```

### 3. Configure Environment

Update `.env` with your database credentials if needed:

```env
DATABASE_URL=postgresql+asyncpg://localhost/documate
JWT_SECRET_KEY=your-secure-random-string-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

### 4. Install Dependencies

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 5. Start the Server

```bash
source venv/bin/activate
uvicorn main:app --reload
```

## 🧪 Testing the Backend

### 1. Test Authentication

```bash
# Register a new user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Copy the access_token from the response

# Get current user info
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. Test Chat Session Creation

```bash
# Create a chat session (it's created automatically on first message)
curl -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, this is my first message"}'

# List chat sessions
curl -X GET http://localhost:8000/chat/sessions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Test Document Upload

```bash
# Upload a document to a specific session
curl -X POST http://localhost:8000/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@test.pdf" \
  -F "session_id=YOUR_SESSION_ID_HERE"
```

### 4. Test Storage Info

```bash
curl -X GET http://localhost:8000/storage \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📊 Database Schema

### Users Table
- `id` (UUID) - Primary key
- `email` (VARCHAR) - Unique, indexed
- `name` (VARCHAR)
- `password_hash` (VARCHAR) - NULL for OAuth users
- `oauth_provider` (VARCHAR) - 'google', 'github', or NULL
- `oauth_id` (VARCHAR)
- `total_storage_bytes` (BIGINT) - Current usage, default 0
- `storage_limit_bytes` (BIGINT) - Limit, default 81.92 MB (85,899,346 bytes)
- `created_at`, `updated_at` (TIMESTAMP)

### Chat Sessions Table
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users
- `title` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

### Documents Table
- `id` (UUID) - Primary key (matches Pinecone file_id)
- `user_id` (UUID) - Foreign key to users
- `session_id` (UUID) - Foreign key to chat_sessions
- `filename` (VARCHAR)
- `chunk_count` (INT)
- `file_size_bytes` (BIGINT)
- `uploaded_at` (TIMESTAMP)

### Chat Messages Table
- `id` (UUID) - Primary key
- `session_id` (UUID) - Foreign key to chat_sessions
- `role` (VARCHAR) - 'user' or 'assistant'
- `content` (TEXT)
- `created_at` (TIMESTAMP)

## 🔑 Key Design Decisions

1. **Session-Scoped Documents**: Documents belong to specific chat sessions, not globally to users. This provides focused context per conversation.

2. **Storage Limits**: Tracked at the user level across all sessions (81.92 MB per user, supporting 25 users on 2GB Pinecone limit), enforced before upload.

3. **JWT Authentication**: Stateless tokens with 30-minute expiration. Consider adding refresh tokens for production.

4. **Async Database**: Using asyncpg for runtime, psycopg2 for migrations (Alembic doesn't support async).

5. **Cascade Deletes**: Deleting a user cascades to sessions, documents, and messages. Deleting a session cascades to its messages.

## 📁 File Structure

```
backend/
├── main.py              # FastAPI app with all endpoints
├── models.py            # SQLAlchemy models
├── database.py          # Database connection
├── auth.py              # Authentication utilities
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables
├── setup_db.sh          # Database setup script
├── alembic.ini          # Alembic configuration
└── alembic/
    ├── env.py           # Alembic environment
    └── versions/
        └── 001_initial_schema.py  # Initial migration
```

## 💾 Storage Limits

- **Per User Limit**: 81.92 MB (85,899,346 bytes)
- **Total Pinecone Capacity**: 2GB free tier
- **Supported Users**: 25 initial users
- **Enforcement**: Checked before each upload
- **Tracking**: Real-time updates on upload/delete

## 🎯 Next Steps: Phase 3 (Frontend Authentication)

Ready to implement:
1. Install NextAuth.js
2. Create auth context and hooks
3. Build login/signup pages
4. Add route protection middleware
5. Update API services with JWT headers

See the plan file for detailed Phase 3 instructions.
