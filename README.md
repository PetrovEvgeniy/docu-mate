# DocuMate AI

An intelligent document management and chat system powered by AI. Upload your documents, organize them, and chat with an AI assistant that has access to your document context.

![DocuMate Banner](docs/images/banner.png)
<!-- TODO: Add banner image -->

## ✨ Features

- 📄 **Document Management** - Upload, organize, and manage your documents
- 💬 **AI-Powered Chat** - Chat with an AI assistant that understands your documents
- 🔍 **Vector Search** - Semantic search across your document collection using Pinecone
- 🔐 **Authentication** - Secure login with email/password or OAuth (Google, GitHub)
- 📊 **Storage Tracking** - Monitor your storage usage and limits
- ☁️ **Cloud-Native** - Deployed on Google Cloud Run for scalability
- 🚀 **CI/CD Pipeline** - Automated testing and deployment with GitHub Actions

## 🔗 Live Links

- **Frontend**: https://docu-mate-frontend-368729308066.us-central1.run.app
- **API Documentation**: 
  - [Swagger UI](https://docu-mate-backend-368729308066.us-central1.run.app/docs) - Interactive API explorer
  - [ReDoc](https://docu-mate-backend-368729308066.us-central1.run.app/redoc) - Alternative API documentation

## 🎬 Demo

### Document Upload
![Document Upload](docs/images/upload-demo.gif)
<!-- TODO: Add GIF showing document upload process -->

### AI Chat
![AI Chat Demo](docs/images/chat-demo.gif)
<!-- TODO: Add GIF showing chat interaction with documents -->

### OAuth Login
![OAuth Login](docs/images/oauth-demo.gif)
<!-- TODO: Add GIF showing Google/GitHub login -->

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js       │
│   Frontend      │
│   (Cloud Run)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────┐
│   FastAPI       │─────→│  Cloud SQL   │
│   Backend       │      │  PostgreSQL  │
│   (Cloud Run)   │      └──────────────┘
└────────┬────────┘
         │
         ├──────→ Pinecone (Vector DB)
         └──────→ Google Gemini (AI)
```

**Tech Stack:**
- **Frontend**: Next.js 16, React, TailwindCSS, NextAuth v5
- **Backend**: FastAPI (Python), SQLAlchemy, Alembic
- **Database**: PostgreSQL (Cloud SQL)
- **Vector Store**: Pinecone
- **AI Model**: Google Gemini
- **Deployment**: Google Cloud Run
- **CI/CD**: GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Docker (optional, for containerized development)
- Google Cloud account (for deployment)
- Pinecone account
- Google Gemini API key

### Local Development Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/PetrovEvgeniy/docu-mate.git
cd docu-mate
```

#### 2. Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For testing

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see Configuration section)

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`

#### 3. Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see Configuration section)

# Start the development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

### Running Tests

**Backend:**
```bash
cd backend
pytest --cov=. --cov-report=term-missing
```

**Frontend:**
```bash
cd frontend
npm test
```

## ⚙️ Configuration

### Backend Environment Variables

Create `backend/.env`:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/documate

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=docu-mate

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
```

### Frontend Environment Variables

Create `frontend/.env`:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# NextAuth Configuration
AUTH_SECRET=your-auth-secret-here  # generate with: openssl rand -hex 32
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Getting API Keys

**Pinecone:**
1. Sign up at [pinecone.io](https://www.pinecone.io/)
2. Create a new index with:
   - Name: `docu-mate`
   - Dimensions: `768` (for Gemini embeddings)
   - Metric: `cosine`

**Google Gemini:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key

**Google OAuth (optional):**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

**GitHub OAuth (optional):**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set authorization callback URL: `http://localhost:3000/api/auth/callback/github`

## 🚢 Deployment to Google Cloud

### Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed

### One-Time Setup

#### 1. Set Up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

#### 2. Create Cloud SQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create docu-mate-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create documate --instance=docu-mate-db

# Create user
gcloud sql users create documate-user \
  --instance=docu-mate-db \
  --password=your-secure-password
```

#### 3. Store Secrets in Secret Manager

```bash
# Backend secrets
echo -n "postgresql+asyncpg://user:password@/documate?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create DATABASE_URL --data-file=-

echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET_KEY --data-file=-
echo -n "your-pinecone-key" | gcloud secrets create PINECONE_API_KEY --data-file=-
echo -n "your-gemini-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "docu-mate" | gcloud secrets create PINECONE_INDEX_NAME --data-file=-

# Frontend secrets
echo -n "your-nextauth-secret" | gcloud secrets create NEXTAUTH_SECRET --data-file=-
echo -n "your-google-client-id" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
echo -n "your-github-client-id" | gcloud secrets create GITHUB_CLIENT_ID --data-file=-
echo -n "your-github-client-secret" | gcloud secrets create GITHUB_CLIENT_SECRET --data-file=-
```

#### 4. Deploy Backend

```bash
cd backend
gcloud builds submit --config cloudbuild.yaml .
```

#### 5. Deploy Frontend

Update `frontend/cloudbuild.yaml` with your backend URL, then:

```bash
cd frontend
gcloud builds submit --config cloudbuild.yaml .
```

### Automated Deployment with GitHub Actions

The repository includes a GitHub Actions workflow for automated deployment on every push to `main`.

#### Setup GitHub Actions:

1. **Set up Workload Identity Federation** (secure, no service account keys):
   - Already configured in your project!
   
2. **Add GitHub Secrets**:
   - Go to: `https://github.com/YOUR_USERNAME/docu-mate/settings/secrets/actions`
   - Add these secrets:
     - `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
     - `GCP_SERVICE_ACCOUNT`: `github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com`

3. **Push to main** → Automatic deployment! 🎉

## 📖 API Documentation

Once the backend is running, visit:
- **Interactive Docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints

**Authentication:**
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/oauth` - OAuth login (Google/GitHub)
- `GET /auth/me` - Get current user info

**Documents:**
- `POST /upload` - Upload document
- `GET /documents` - List user's documents
- `DELETE /documents/{id}` - Delete document
- `GET /storage` - Get storage usage

**Chat:**
- `POST /chat` - Send chat message
- `GET /chat/sessions` - List chat sessions
- `POST /chat/sessions` - Create new session
- `GET /chat/sessions/{id}/messages` - Get session messages

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest -v                           # Run all tests
pytest tests/test_auth.py -v       # Run specific test file
pytest --cov=. --cov-report=html   # Generate coverage report
```

### Frontend Tests

```bash
cd frontend
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pytest` for backend, `npm test` for frontend)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

**Backend (Python):**
- Follow PEP 8
- Use type hints
- Write docstrings for functions

**Frontend (TypeScript):**
- Follow ESLint rules
- Use TypeScript strict mode
- Write component tests

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [Next.js](https://nextjs.org/) - Frontend framework
- [Pinecone](https://www.pinecone.io/) - Vector database
- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI model
- [NextAuth](https://next-auth.js.org/) - Authentication


---

**Live Demo:** https://docu-mate-frontend-368729308066.us-central1.run.app

Built with ❤️ using Next.js, FastAPI, and Google Cloud
