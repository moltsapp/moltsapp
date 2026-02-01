#!/usr/bin/env bash
# Map moltsapp.xyz (or a subdomain) to the moltsapp-directory Cloud Run service.
# Prereqs: gcloud auth login, billing enabled, domain moltsapp.xyz owned by you.
# Run from repo root or apps/moltsapp-directory.
set -e

PROJECT_ID="${PROJECT_ID:-project-d0e342fb-4570-4e51-b71}"
REGION="${REGION:-us-central1}"

# Use subdomain directory.moltsapp.xyz by default so moltsapp.xyz can be a website later.
DOMAIN="${1:-directory.moltsapp.xyz}"

echo "Mapping $DOMAIN -> moltsapp-directory (project $PROJECT_ID, region $REGION)"
echo ""

# 1. Verify base domain (moltsapp.xyz) if not already verified
BASE_DOMAIN="moltsapp.xyz"
echo "If $BASE_DOMAIN is not verified yet, run: gcloud domains verify $BASE_DOMAIN"
echo "Then complete verification in Search Console."
echo ""

gcloud config set project "$PROJECT_ID" --quiet

# 2. Create domain mapping (beta)
echo "Creating domain mapping..."
gcloud beta run domain-mappings create \
  --service=moltsapp-directory \
  --domain="$DOMAIN" \
  --region="$REGION" \
  --quiet 2>/dev/null || {
  echo "Mapping may already exist. Fetching DNS records..."
}

# 3. Show DNS records to add at your registrar
echo ""
echo "=== Add these DNS records at your domain registrar (moltsapp.xyz) ==="
gcloud beta run domain-mappings describe --domain="$DOMAIN" --region="$REGION" --format="yaml(resourceRecords)"

echo ""
echo "After adding the records, wait a few minutes (SSL can take up to 24h)."
echo "Then test: https://$DOMAIN/v1/bots"
echo "Set DIRECTORY_URL=https://$DOMAIN for bots and register-bot.ts"
