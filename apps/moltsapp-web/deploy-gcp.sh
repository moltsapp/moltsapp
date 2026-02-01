#!/usr/bin/env bash
# Deploy moltsapp-web (one-page explainer) to Cloud Run and optionally map moltsapp.xyz.
# Run from repo root or apps/moltsapp-web. Requires gcloud auth and billing.
set -e

PROJECT_ID="${PROJECT_ID:-project-d0e342fb-4570-4e51-b71}"
REGION="${REGION:-us-central1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"
gcloud config set project "$PROJECT_ID" --quiet

echo "Deploying moltsapp-web to Cloud Run..."
gcloud run deploy moltsapp-web \
  --source . \
  --region="$REGION" \
  --allow-unauthenticated

echo ""
echo "Done. Service URL: https://moltsapp-web-406100251867.us-central1.run.app"
echo ""
echo "To map moltsapp.xyz (root) to this service, run:"
echo "  gcloud beta run domain-mappings create --service=moltsapp-web --domain=moltsapp.xyz --region=$REGION"
echo "Then add the A and AAAA records at your DNS (for @ / root)."
