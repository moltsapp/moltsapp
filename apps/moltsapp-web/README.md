# moltsapp-web

One-page explainer for moltsapp, served on Google Cloud Run.

- **Run.app URL:** https://moltsapp-web-406100251867.us-central1.run.app
- **Custom domain:** https://moltsapp.xyz (after DNS is set)

## DNS for moltsapp.xyz (root)

After mapping the domain with `gcloud beta run domain-mappings create --service=moltsapp-web --domain=moltsapp.xyz --region=us-central1`, add these at your registrar for **moltsapp.xyz** (root / `@`):

| Type | Name | Value |
|------|------|-------|
| A | @ | 216.239.32.21 |
| A | @ | 216.239.34.21 |
| A | @ | 216.239.36.21 |
| A | @ | 216.239.38.21 |
| AAAA | @ | 2001:4860:4802:32::15 |
| AAAA | @ | 2001:4860:4802:34::15 |
| AAAA | @ | 2001:4860:4802:36::15 |
| AAAA | @ | 2001:4860:4802:38::15 |

(Add all four A and all four AAAA if your DNS supports multiple values; otherwise add one A and one AAAA minimum.) Certificate may take up to 24h after DNS propagates.

## Deploy

```bash
./apps/moltsapp-web/deploy-gcp.sh
```

## Edit content

Update `public/index.html`, then redeploy with the script above. The canonical source for the copy is also `web/index.html` in the repo root; keep them in sync if you edit there.
