# DocuMate - Docker Setup Guide

## 🐳 Running with Docker (Recommended)

Docker eliminates all manual setup - no need to install PostgreSQL, Python, or Node.js. Everything runs in isolated containers.

### **Prerequisites**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### **Quick Start**

1. **Clone and navigate to the project:**
   ```bash
   cd docu-mate
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your API keys:**
   ```bash
   # Required
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_INDEX_NAME=your-index-name
   GEMINI_API_KEY=your-gemini-api-key
   
   # Generate secrets (run these commands):
   JWT_SECRET_KEY=$(openssl rand -base64 32)
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   ```

4. **Start everything:**
   ```bash
   docker-compose up
   ```

5. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

That's it! 🎉 Docker handles:
- PostgreSQL database setup
- Database migrations
- Python dependencies (greenlet, bcrypt, etc.)
- Node.js dependencies
- Hot reload for development

### **Common Commands**

```bash
# Start services (detached mode)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build

# Run database migrations manually
docker-compose exec backend alembic upgrade head

# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d documate
```

### **What's Running?**

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| PostgreSQL | `documate-db` | 5432 | Database |
| Backend | `documate-backend` | 8000 | FastAPI server |
| Frontend | `documate-frontend` | 3000 | Next.js app |

### **File Structure**

```
docu-mate/
├── docker-compose.yml       # Orchestrates all services
├── .env                     # Your environment variables (gitignored)
├── .env.example            # Template for .env
├── backend/
│   ├── Dockerfile          # Backend container config
│   ├── .dockerignore       # Files to exclude from build
│   └── ...
└── frontend/
    ├── Dockerfile          # Frontend container config
    ├── .dockerignore       # Files to exclude from build
    └── ...
```

### **Development Workflow**

**Hot Reload is Enabled:**
- Edit Python files → backend restarts automatically
- Edit React/Next.js files → frontend rebuilds automatically
- No need to restart containers for code changes

**Database Migrations:**
```bash
# Create new migration
docker-compose exec backend alembic revision -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback
docker-compose exec backend alembic downgrade -1
```

### **Troubleshooting**

**"Port already in use":**
```bash
# Stop local PostgreSQL/services first
brew services stop postgresql@16

# Or change ports in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead of 5432
```

**"Database connection failed":**
```bash
# Check if postgres is healthy
docker-compose ps

# View postgres logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

**"Cannot connect to Docker daemon":**
- Make sure Docker Desktop is running
- On macOS: Check Docker icon in menu bar

**Clean slate (reset everything):**
```bash
docker-compose down -v
docker-compose up --build
```

---

## 🛠️ Manual Setup (Without Docker)

If you prefer not to use Docker, see [MANUAL_SETUP.md](MANUAL_SETUP.md) for instructions.

---

## 📝 Next Steps

After Docker is running:

1. **Test Authentication:**
   - Sign up at http://localhost:3000/signup
   - Login and verify user menu appears

2. **Continue Development:**
   - Phase 4: Chat session management
   - Phase 5: Document management with auth

3. **Deploy to Production:**
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment guides
