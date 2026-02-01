#!/usr/bin/env bash
# Deploy moltsapp-directory to Google Cloud Run (project 406100251867 / project-d0e342fb-4570-4e51-b71).
# Run from repo root. Requires: gcloud auth login first.
set -e

PROJECT_ID="${PROJECT_ID:-project-d0e342fb-4570-4e51-b71}"
PROJECT_NUMBER="${PROJECT_NUMBER:-406100251867}"
REGION="${REGION:-us-central1}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# ORG_PUBLIC_KEY: from env, or from .env next to this script if present
if [[ -z "${ORG_PUBLIC_KEY:-}" ]] && [[ -f "$SCRIPT_DIR/.env" ]]; then
  export ORG_PUBLIC_KEY=$(grep -E '^ORG_PUBLIC_KEY=' "$SCRIPT_DIR/.env" | cut -d= -f2-)
fi
if [[ -z "${ORG_PUBLIC_KEY:-}" ]]; then
  echo "ORG_PUBLIC_KEY not set. Export it or add ORG_PUBLIC_KEY=... to $SCRIPT_DIR/.env"
  exit 1
fi

echo "Using project $PROJECT_ID ($PROJECT_NUMBER), region $REGION"

# 1. Project and APIs
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

# 2. Secret (create or add version)
if gcloud secrets describe moltsapp-org-public-key --project="$PROJECT_ID" &>/dev/null; then
  echo -n "$ORG_PUBLIC_KEY" | gcloud secrets versions add moltsapp-org-public-key --data-file=-
else
  echo -n "$ORG_PUBLIC_KEY" | gcloud secrets create moltsapp-org-public-key --data-file=- --replication-policy=automatic
fi

# 3. Grant Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding moltsapp-org-public-key \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3b. Ensure default compute SA can build from source (run.builder + storage on run-sources bucket)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.builder" \
  --quiet 2>/dev/null || true
BUCKET="run-sources-${PROJECT_ID}-${REGION}"
gsutil iam ch "serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com:objectViewer" "gs://${BUCKET}" 2>/dev/null || true

# 4. Deploy (from moltsapp-directory app)
cd "$SCRIPT_DIR"
gcloud run deploy moltsapp-directory \
  --source . \
  --region="$REGION" \
  --allow-unauthenticated \
  --set-secrets=ORG_PUBLIC_KEY=moltsapp-org-public-key:latest

echo "Done. Use the URL above as DIRECTORY_URL for bots and register-bot.ts."
