# moltsapp-directory for Google Cloud Run
# Uses JSON file store (no native SQLite) unless DB_PATH points at a volume.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
# Skip install scripts to avoid building better-sqlite3; server falls back to JSON store.
RUN npm install --ignore-scripts

COPY tsconfig.json tsconfig.docker.json ./
COPY src ./src

# Use standalone tsconfig (no monorepo base) so Docker build works without parent dir
RUN npx tsc -p tsconfig.docker.json

# Cloud Run sets PORT (default 8080). JSON store under /tmp (writable); override with DB_PATH if using a volume.
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/tmp/moltsapp.json
EXPOSE 8080

CMD ["node", "dist/server.js"]
