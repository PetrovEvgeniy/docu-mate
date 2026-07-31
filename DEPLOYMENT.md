# Google Cloud Platform Deployment Guide

This guide will help you deploy DocuMate to Google Cloud Platform using Cloud Run and Cloud SQL.

## Prerequisites

1. **Google Cloud Account** with billing enabled ($300 free credit for new users)
2. **gcloud CLI** installed: https://cloud.google.com/sdk/docs/install
3. **Docker** installed locally (for testing)
4. **External API Keys**:
   - Pinecone API key
   - Google Gemini API key
   - Google OAuth credentials (for authentication)
   - GitHub OAuth credentials (optional)

## Cost Estimate

**Free Tier Usage:**
- Cloud Run: 2M requests/month free
- Cloud SQL: First 90 days $300 credit
- Container Registry: 0.5 GB storage free

**After Free Tier:**
- Cloud Run: ~$5-10/month (low traffic)
- Cloud SQL (db-f1-micro): ~$7/month
- **Total**: ~$12-17/month for hobby project

---

## Step 1: Set Up Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project
gcloud projects create docu-mate-prod --name="DocuMate Production"

# Set project as default
gcloud config set project docu-mate-prod

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com
```

---

## Step 2: Create Cloud SQL PostgreSQL Database

```bash
# Create Cloud SQL instance (this takes 5-10 minutes)
gcloud sql instances create docu-mate-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=CHANGE_THIS_PASSWORD \
  --backup-start-time=03:00 \
  --enable-bin-log

# Create database
gcloud sql databases create documate --instance=docu-mate-db

# Create database user
gcloud sql users create documate_user \
  --instance=docu-mate-db \
  --password=CHANGE_THIS_PASSWORD

# Get connection name (save this for later)
gcloud sql instances describe docu-mate-db --format="value(connectionName)"
# Output example: docu-mate-prod:us-central1:docu-mate-db
```

---

## Step 3: Create Secrets in Secret Manager

```bash
# Create secrets for sensitive data
echo -n "postgresql://documate_user:YOUR_PASSWORD@/documate?host=/cloudsql/YOUR_CONNECTION_NAME" | \
  gcloud secrets create DATABASE_URL --data-file=-

echo -n "$(openssl rand -hex 32)" | \
  gcloud secrets create JWT_SECRET_KEY --data-file=-

echo -n "$(openssl rand -hex 32)" | \
  gcloud secrets create NEXTAUTH_SECRET --data-file=-

echo -n "YOUR_PINECONE_API_KEY" | \
  gcloud secrets create PINECONE_API_KEY --data-file=-

echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-

echo -n "YOUR_GOOGLE_CLIENT_ID" | \
  gcloud secrets create GOOGLE_CLIENT_ID --data-file=-

echo -n "YOUR_GOOGLE_CLIENT_SECRET" | \
  gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-

echo -n "YOUR_GITHUB_CLIENT_ID" | \
  gcloud secrets create GITHUB_CLIENT_ID --data-file=-

echo -n "YOUR_GITHUB_CLIENT_SECRET" | \
  gcloud secrets create GITHUB_CLIENT_SECRET --data-file=-
```

---

## Step 4: Grant Cloud Run Access to Secrets

```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe docu-mate-prod --format="value(projectNumber)")

# Grant Secret Manager access to Cloud Run service account
gcloud projects add-iam-policy-binding docu-mate-prod \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud SQL access to Cloud Run
gcloud projects add-iam-policy-binding docu-mate-prod \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

---

## Step 5: Build and Deploy Backend

```bash
# Build backend container
cd backend
gcloud builds submit --tag gcr.io/docu-mate-prod/docu-mate-backend

# Deploy backend to Cloud Run
gcloud run deploy docu-mate-backend \
  --image gcr.io/docu-mate-prod/docu-mate-backend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances docu-mate-prod:us-central1:docu-mate-db \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET_KEY=JWT_SECRET_KEY:latest,PINECONE_API_KEY=PINECONE_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300s

# Get backend URL (save this for frontend configuration)
gcloud run services describe docu-mate-backend --region us-central1 --format="value(status.url)"
```

---

## Step 6: Build and Deploy Frontend

```bash
# Build frontend container
cd ../frontend
gcloud builds submit --tag gcr.io/docu-mate-prod/docu-mate-frontend

# Deploy frontend to Cloud Run
# Replace BACKEND_URL with the URL from Step 5
gcloud run deploy docu-mate-frontend \
  --image gcr.io/docu-mate-prod/docu-mate-frontend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars=NEXT_PUBLIC_API_BASE=BACKEND_URL \
  --set-secrets=NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GITHUB_CLIENT_ID=GITHUB_CLIENT_ID:latest,GITHUB_CLIENT_SECRET=GITHUB_CLIENT_SECRET:latest \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 60s

# Get frontend URL
gcloud run services describe docu-mate-frontend --region us-central1 --format="value(status.url)"
```

---

## Step 7: Configure OAuth Redirect URIs

After deployment, update your OAuth applications:

### Google OAuth Console
1. Go to: https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://YOUR_FRONTEND_URL/api/auth/callback/google
   ```

### GitHub OAuth Settings
1. Go to: https://github.com/settings/developers
2. Edit your OAuth App
3. Add authorization callback URL:
   ```
   https://YOUR_FRONTEND_URL/api/auth/callback/github
   ```

---

## Step 8: Run Database Migrations

```bash
# Connect to Cloud SQL via proxy
cloud-sql-proxy docu-mate-prod:us-central1:docu-mate-db &

# In another terminal, run migrations
cd backend
export DATABASE_URL="postgresql://documate_user:YOUR_PASSWORD@localhost:5432/documate"
python -c "from database import engine, Base; Base.metadata.create_all(bind=engine)"
```

---

## Step 9: Set Up Continuous Deployment (Optional)

Connect your GitHub repository to Cloud Build for automatic deployments:

```bash
# Create Cloud Build trigger
gcloud beta builds triggers create github \
  --repo-name=docu-mate \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Monitoring and Logs

### View Logs
```bash
# Backend logs
gcloud run services logs read docu-mate-backend --region us-central1 --limit 50

# Frontend logs
gcloud run services logs read docu-mate-frontend --region us-central1 --limit 50
```

### View Metrics
```bash
# Open Cloud Console
gcloud console
# Navigate to: Cloud Run → Select Service → Metrics
```

---

## Updating the Application

### Update Backend
```bash
cd backend
gcloud builds submit --tag gcr.io/docu-mate-prod/docu-mate-backend
gcloud run deploy docu-mate-backend --image gcr.io/docu-mate-prod/docu-mate-backend --region us-central1
```

### Update Frontend
```bash
cd frontend
gcloud builds submit --tag gcr.io/docu-mate-prod/docu-mate-frontend
gcloud run deploy docu-mate-frontend --image gcr.io/docu-mate-prod/docu-mate-frontend --region us-central1
```

---

## Troubleshooting

### Backend Container Won't Start
```bash
# Check build logs
gcloud builds list --limit 5

# Check service logs
gcloud run services logs read docu-mate-backend --region us-central1 --limit 100
```

### Database Connection Issues
```bash
# Test Cloud SQL connection
gcloud sql connect docu-mate-db --user=documate_user

# Verify service account permissions
gcloud projects get-iam-policy docu-mate-prod
```

### Secret Access Issues
```bash
# List secrets
gcloud secrets list

# Check secret access
gcloud secrets versions access latest --secret=DATABASE_URL
```

---

## Cost Optimization

### Reduce Costs for Development
```bash
# Set minimum instances to 0 (default, but verify)
gcloud run services update docu-mate-backend --min-instances 0 --region us-central1
gcloud run services update docu-mate-frontend --min-instances 0 --region us-central1

# Use smaller database tier
gcloud sql instances patch docu-mate-db --tier=db-f1-micro
```

### Monitor Costs
```bash
# Set up billing alerts in Cloud Console
gcloud console
# Navigate to: Billing → Budgets & alerts
```

---

## Cleanup (Delete Everything)

```bash
# Delete Cloud Run services
gcloud run services delete docu-mate-backend --region us-central1 --quiet
gcloud run services delete docu-mate-frontend --region us-central1 --quiet

# Delete Cloud SQL instance
gcloud sql instances delete docu-mate-db --quiet

# Delete container images
gcloud container images delete gcr.io/docu-mate-prod/docu-mate-backend --quiet
gcloud container images delete gcr.io/docu-mate-prod/docu-mate-frontend --quiet

# Delete secrets
gcloud secrets delete DATABASE_URL --quiet
gcloud secrets delete JWT_SECRET_KEY --quiet
gcloud secrets delete PINECONE_API_KEY --quiet
gcloud secrets delete GEMINI_API_KEY --quiet
gcloud secrets delete NEXTAUTH_SECRET --quiet
gcloud secrets delete GOOGLE_CLIENT_ID --quiet
gcloud secrets delete GOOGLE_CLIENT_SECRET --quiet
gcloud secrets delete GITHUB_CLIENT_ID --quiet
gcloud secrets delete GITHUB_CLIENT_SECRET --quiet

# Delete project (WARNING: This deletes EVERYTHING)
gcloud projects delete docu-mate-prod
```

---

## Next Steps

1. **Set up custom domain** (optional):
   ```bash
   gcloud run domain-mappings create --service docu-mate-frontend --domain yourdomain.com --region us-central1
   ```

2. **Enable CORS** if needed (already configured in backend/main.py)

3. **Set up monitoring alerts** in Google Cloud Console

4. **Configure backups** for Cloud SQL (enabled by default)

5. **Add a README.md** with screenshots and deployment URL for your portfolio

---

## Support

For issues, check:
- Google Cloud Run Docs: https://cloud.google.com/run/docs
- Cloud SQL Docs: https://cloud.google.com/sql/docs
- Stack Overflow: Tag `google-cloud-run`
