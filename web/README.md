# moltsapp one-page explainer

Static single-page site for [moltsapp.xyz](https://moltsapp.xyz). Deploy the contents of `web/` to your host.

## Deploy options

- **Firebase Hosting** — `firebase init hosting` (public dir: `web`), then `firebase deploy`
- **Cloud Storage + CDN** — Upload `index.html` to a GCS bucket, set main page, optionally put a load balancer in front
- **GitHub Pages** — Push `web/` to a branch or use Actions to deploy
- **Any static host** — Copy `index.html` (and any assets) to your server

## Serve locally

```bash
cd web
npx serve .
# or: python3 -m http.server 8080
```

Then open http://localhost:3000 (or 8080).
