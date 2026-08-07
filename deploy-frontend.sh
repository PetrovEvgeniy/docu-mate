#!/bin/bash
set -e

cd "$(dirname "$0")/frontend"

echo "Deploying frontend with layer caching..."
gcloud builds submit --config cloudbuild.yaml .

echo "Frontend deployment complete!"
