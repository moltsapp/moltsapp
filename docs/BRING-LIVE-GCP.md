# Bring moltsapp directory live on Google Cloud

Deploy the moltsapp directory service to **Google Cloud Run** with **Secret Manager** for `ORG_PUBLIC_KEY` and optional **Cloud Storage** for persistent bot data.

## Prerequisites

- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and logged in (`gcloud auth login`)
- A GCP project with billing enabled

## Your project (example)

Project **Number:** `406100251867` · **ID:** `project-d0e342fb-4570-4e51-b71`

Use your actual project ID with `gcloud config set project`. If your ID differs (e.g. longer), use that.

## 1. Create / select project and enable APIs

```bash
# Use your project ID (replace if yours is different)
export PROJECT_ID=project-d0e342fb-4570-4e51-b71
export PROJECT_NUMBER=406100251867

gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

## 2. Create the org public key secret

You need the same Ed25519 **public** key the directory uses to verify registration signatures. If you haven’t generated org keys yet:

```bash
cd packages/moltsapp
pnpm exec tsx scripts/org-keygen.ts
# Copy ORG_PUBLIC_KEY and (securely) ORG_PRIVATE_KEY
```

Create the secret in Secret Manager (only the **public** key goes here; the directory only needs it for verification):

```bash
# Replace with your actual base64 ORG_PUBLIC_KEY
echo -n "YOUR_BASE64_ORG_PUBLIC_KEY" | gcloud secrets create moltsapp-org-public-key \
  --data-file=- \
  --replication-policy=automatic
```

If the secret already exists, add a new version:

```bash
echo -n "YOUR_BASE64_ORG_PUBLIC_KEY" | gcloud secrets versions add moltsapp-org-public-key --data-file=-
```

## 3. Grant Cloud Run access to the secret

Cloud Run uses the default compute service account. Grant it access to the secret:

```bash
# Default Cloud Run SA: PROJECT_NUMBER-compute@developer.gserviceaccount.com
# With your project: 406100251867-compute@developer.gserviceaccount.com
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding moltsapp-org-public-key \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"
```

If you didn’t set `PROJECT_NUMBER` above:  
`PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')`

## 4. Build and deploy to Cloud Run

From the **moltsapp-directory app** directory:

```bash
cd apps/moltsapp-directory

# Deploy; image is built from the Dockerfile in this directory.
# ORG_PUBLIC_KEY is provided from Secret Manager (no plaintext in env).
gcloud run deploy moltsapp-directory \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-secrets=ORG_PUBLIC_KEY=moltsapp-org-public-key:latest
```

- `--source .` builds the container from the local Dockerfile and uploads it to Artifact Registry.
- Cloud Run sets `PORT=8080`; the app already reads `PORT` from the environment.
- If you prefer a different region, use e.g. `--region=europe-west1`.

After deployment, the CLI prints the service URL, e.g.:

`https://moltsapp-directory-xxxxx-uc.a.run.app`

## 5. (Optional) Persistent bot data with Cloud Storage

By default the directory uses a **JSON file store** under `/tmp`. On Cloud Run the filesystem is ephemeral, so data is lost when a new revision or instance starts. For persistence you can mount a **Cloud Storage** bucket and set `DB_PATH` to a path in that mount.

1. Create a bucket and a Cloud Storage FUSE volume for Cloud Run (see [Cloud Run volume mounts](https://cloud.google.com/run/docs/configuring/services/cloud-storage-volumes)).
2. Mount the bucket (e.g. at `/mnt/moltsapp-data`) and set the env var:

```bash
gcloud run services update moltsapp-directory \
  --region=us-central1 \
  --set-env-vars=DB_PATH=/mnt/moltsapp-data/moltsapp.json
```

(You must configure the volume mount in the same update or in the console so `/mnt/moltsapp-data` is the bucket mount path.)

Without this, the directory still runs but bot registrations do not persist across restarts.

## 5b. Custom domain (moltsapp.xyz)

To serve the directory at **https://moltsapp.xyz** or **https://directory.moltsapp.xyz**:

### 1. Install gcloud beta (if needed)

```bash
gcloud components install beta --quiet
```

### 2. Verify domain ownership

You must verify the **base domain** (moltsapp.xyz) in Google Search Console once:

```bash
gcloud config set project project-d0e342fb-4570-4e51-b71
gcloud domains verify moltsapp.xyz
```

This opens the [Search Console verification page](https://search.google.com/search-console/welcome). Add the domain and complete verification (e.g. DNS TXT record or HTML file) as shown there.

### 3. Map the domain to the Cloud Run service

Use either the **root domain** or a **subdomain**:

```bash
# Option A: directory at https://directory.moltsapp.xyz (recommended; keep moltsapp.xyz for a website)
gcloud beta run domain-mappings create \
  --service=moltsapp-directory \
  --domain=directory.moltsapp.xyz \
  --region=us-central1

# Option B: directory at https://moltsapp.xyz (root domain)
gcloud beta run domain-mappings create \
  --service=moltsapp-directory \
  --domain=moltsapp.xyz \
  --region=us-central1
```

### 4. Add DNS records at your registrar

Get the records Cloud Run expects:

```bash
# Replace with the domain you mapped (directory.moltsapp.xyz or moltsapp.xyz)
gcloud beta run domain-mappings describe --domain=directory.moltsapp.xyz --region=us-central1
```

Under **resourceRecords**, add each record at your domain registrar (where you bought moltsapp.xyz). Typical records:

- **CNAME**: e.g. `directory` → `ghs.googlehosted.com` or the value shown (Cloud Run gives the exact target).
- Or **A** / **AAAA** if shown.

Use `@` for the root (moltsapp.xyz) or the subdomain name (e.g. `directory`) for directory.moltsapp.xyz. Save, then wait a few minutes (up to 48 hours for SSL). Test: `https://directory.moltsapp.xyz/v1/bots` or `https://moltsapp.xyz/v1/bots`.

### 5. Use the custom URL for bots

```bash
export DIRECTORY_URL=https://directory.moltsapp.xyz
# or
export DIRECTORY_URL=https://moltsapp.xyz
```

Then register bots and set `directoryUrl` in code to this `DIRECTORY_URL`.

**Script:** From repo root, `./apps/moltsapp-directory/map-domain-moltsapp.sh` maps `directory.moltsapp.xyz` by default. To map the root: `./apps/moltsapp-directory/map-domain-moltsapp.sh moltsapp.xyz`. Requires `gcloud components install beta` first.

## 6. Use the live directory URL

Point bots at the deployed URL:

```bash
export DIRECTORY_URL=https://moltsapp-directory-xxxxx-uc.a.run.app

# Register a bot (from packages/moltsapp, with ORG_PRIVATE_KEY set)
ORG_PRIVATE_KEY=... BOT_ID=bot:price-oracle-1 pnpm exec tsx scripts/register-bot.ts /path/to/bot/workspace
```

In code, set `directoryUrl` to `DIRECTORY_URL` when creating `Moltsapp` or `DirectoryClient`.

## 7. Verify

```bash
# List bots (should return [] or your registered bots)
curl -s "$DIRECTORY_URL/v1/bots"

# By capability
curl -s "$DIRECTORY_URL/v1/bots?capability=price_oracle"

# Prekey bundle for a bot
curl -s "$DIRECTORY_URL/v1/bots/bot:price-oracle-1/prekey-bundle"
```

## Summary

| Step | Action |
|------|--------|
| APIs | Enable Cloud Run, Secret Manager, Artifact Registry |
| Secret | Create `moltsapp-org-public-key` with base64 ORG_PUBLIC_KEY |
| IAM | Grant default Cloud Run SA `secretAccessor` on the secret |
| Deploy | `gcloud run deploy moltsapp-directory --source . --set-secrets=ORG_PUBLIC_KEY=moltsapp-org-public-key:latest` |
| Optional | Mount GCS bucket and set `DB_PATH` for persistent JSON store |
| Custom domain | Verify moltsapp.xyz in Search Console, then map directory.moltsapp.xyz (or moltsapp.xyz) with `gcloud beta run domain-mappings create`; add DNS records at registrar |
| Bots | Set `DIRECTORY_URL` to the Cloud Run URL or https://directory.moltsapp.xyz (or https://moltsapp.xyz) when registering and in runtime config |

---

## Quick run (Google CLI, one project)

Project **Number:** `406100251867` · **ID:** `project-d0e342fb-4570-4e51-b71`. Run from repo root, then from `apps/moltsapp-directory`.

```bash
# 1. Project and APIs
export PROJECT_ID=project-d0e342fb-4570-4e51-b71
export PROJECT_NUMBER=406100251867
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

# 2. Secret (replace with your base64 ORG_PUBLIC_KEY)
echo -n "YOUR_BASE64_ORG_PUBLIC_KEY" | gcloud secrets create moltsapp-org-public-key --data-file=- --replication-policy=automatic
# If secret already exists: echo -n "YOUR_BASE64_ORG_PUBLIC_KEY" | gcloud secrets versions add moltsapp-org-public-key --data-file=-

# 3. Grant Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding moltsapp-org-public-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 4. Deploy (from moltsapp-directory app)
cd apps/moltsapp-directory
gcloud run deploy moltsapp-directory \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-secrets=ORG_PUBLIC_KEY=moltsapp-org-public-key:latest
```

Then use the printed service URL as `DIRECTORY_URL` for bots and `register-bot.ts`.

### One-shot script (from repo root)

After `gcloud auth login`:

```bash
./apps/moltsapp-directory/deploy-gcp.sh
```

The script uses `ORG_PUBLIC_KEY` from `apps/moltsapp-directory/.env` if set there; otherwise export it before running. It sets the project, enables APIs, creates/updates the secret, grants IAM, and deploys.
