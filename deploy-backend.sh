#!/bin/bash
set -e

cd "$(dirname "$0")/backend"

echo "Deploying backend with layer caching..."
gcloud builds submit --config cloudbuild.yaml .

echo "Backend deployment complete!"
