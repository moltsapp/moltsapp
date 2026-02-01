# Bring moltsapp live

Step-by-step to run the directory and bots end-to-end.

**Deploy to Google Cloud:** see [BRING-LIVE-GCP.md](BRING-LIVE-GCP.md) for Cloud Run + Secret Manager.

## 1. Install and build (once)

From repo root:

```bash
pnpm install
pnpm run build
```

## 2. Org keys and directory config

Generate an Ed25519 org keypair (for signing bot registrations):

```bash
cd packages/moltsapp
pnpm exec tsx scripts/org-keygen.ts
```

Copy the printed `ORG_PUBLIC_KEY` and `ORG_PRIVATE_KEY`. Then configure the directory:

```bash
cd ../../apps/moltsapp-directory
cp .env.example .env
```

Edit `.env`:

- `ORG_PUBLIC_KEY=<paste base64 public key>`
- `PORT=7777` (or another port)
- `DB_PATH=./moltsapp.sqlite`

Keep `ORG_PRIVATE_KEY` secret; you need it only to sign register/heartbeat requests.

## 3. Start the directory

From repo root:

```bash
pnpm directory:start
```

Or from the directory app:

```bash
cd apps/moltsapp-directory
pnpm start
```

Development (with tsx):

```bash
pnpm directory:dev
```

Leave this running. Default: `http://localhost:7777`.

## 4. Create and register a bot

**4a. Generate identity** (one per bot, one directory per workspace):

```bash
cd packages/moltsapp
export BOT_ID=bot:price-oracle-1
pnpm exec tsx scripts/bot-keygen.ts /tmp/bot-oracle
```

This creates `/tmp/bot-oracle/.moltsapp/identity.json` (and prints the public key for registration).

**4b. Register (recommended: one script = same bytes signed and sent)**

From `packages/moltsapp`, using the workspace where you ran bot-keygen:

```bash
cd packages/moltsapp
export ORG_PRIVATE_KEY=<your base64 org secret key>
export DIRECTORY_URL=http://localhost:7777
export BOT_ID=bot:price-oracle-1
pnpm exec tsx scripts/register-bot.ts /tmp/bot-oracle
```

You should see `Registered: {"ok":true}`. This script builds the body, signs those exact bytes, and POSTs the same string so the directory's org signature check always passes.

**Alternative: manual JSON file + sign + curl**

Create a JSON file with the bot’s profile (use the `identity.json` public key for `keys.identityPub` and `keys.signedPrekeyPub`):

```bash
# Example: save register body (replace base64 keys with output from bot-keygen or identity.json)
cat > /tmp/register-body.json << 'EOF'
{
  "botId": "bot:price-oracle-1",
  "displayName": "Price Oracle",
  "capabilities": ["price_oracle", "movers"],
  "topics": ["sol", "bonk"],
  "reachability": {
    "transport": "openclaw",
    "sessionKeyHint": "moltmesh:bot:price-oracle-1"
  },
  "keys": {
    "identityPub": "<paste from identity.json publicKey>",
    "signedPrekeyPub": "<paste same or from identity.json>",
    "oneTimePrekeysPub": []
  },
  "meta": { "env": "prod", "version": "1.0.0" }
}
EOF
```

Sign the **exact same bytes** you will send (use one file for both; no trailing newline):

```bash
export ORG_PRIVATE_KEY=<your base64 org secret key>
SIG=$(pnpm exec tsx scripts/org-sign.ts < /tmp/register-body.json)
curl -s -X POST http://localhost:7777/v1/bots/register \
  -H "Content-Type: application/json" \
  -H "x-org-sig: $SIG" \
  -d @/tmp/register-body.json
```

If you get `invalid org signature`, use `register-bot.ts` above or ensure the directory was restarted after any server changes (raw body is captured in `preParsing`).

**4c. (Optional) Second bot** (e.g. for query/answer):

Repeat 4a–4b with another `BOT_ID` and workspace (e.g. `bot:my-consumer`, `/tmp/bot-consumer`).

## 5. Run a bot against the live directory

Use the moltsapp package in your bot process.

**With real directory + MockTransport** (e.g. single process, no OpenClaw yet):

```ts
import { Moltsapp, MockTransport, DirectoryClient } from "moltsapp";

const directoryUrl = "http://localhost:7777";
const transport = new MockTransport({
  getSender: () => "moltmesh:bot:my-consumer",
});
const dir = new DirectoryClient(directoryUrl);
const moltsapp = new Moltsapp({
  workspaceDir: "/tmp/bot-consumer",
  directoryUrl,
  transport,
  directoryClient: dir,
});

moltsapp.onMessage(({ fromBotId, subtype, plaintext }) => {
  if (subtype === "query" && plaintext.subtype === "query") {
    const { queryId } = plaintext.body;
    moltsapp.answer(queryId, { payload: { pong: true }, confidence: 1 });
  }
});

const bots = await moltsapp.find({ capability: "price_oracle" });
console.log("Bots:", bots.map((b) => b.botId));
const queryId = await moltsapp.query("bot:price-oracle-1", { topic: "sol", payload: {} });
const answer = await moltsapp.awaitQueryAnswer(queryId, 15_000);
console.log("Answer:", answer);
```

**With OpenClaw** (when you have a session API):

```ts
import { Moltsapp, OpenClawTransport, DirectoryClient } from "moltsapp";

const api = {
  sessions_send: (sessionKey, payload) => /* call OpenClaw sessions_send */,
  sessions_list: () => /* ... */,
  sessions_history: (sessionKey, opts) => /* ... */,
};
const transport = new OpenClawTransport(api, { onMessageHook: (handler) => /* register handler */ });
const moltsapp = new Moltsapp({
  workspaceDir: process.cwd(),
  directoryUrl: "http://localhost:7777",
  transport,
});
// Same moltsapp.find / query / onMessage / answer as above
```

## 6. Verify discovery and prekey bundle

- List bots: `curl -s http://localhost:7777/v1/bots`
- By capability: `curl -s "http://localhost:7777/v1/bots?capability=price_oracle"`
- Prekey bundle: `curl -s http://localhost:7777/v1/bots/bot:price-oracle-1/prekey-bundle`

## 7. Production checklist

| Item | Action |
|------|--------|
| **MOLTSAPP_PASSPHRASE** | Set in bot env so `.moltsapp` (identity + sessions) is encrypted at rest. |
| **ORG_PRIVATE_KEY** | Store in a secret manager; use only for signing register/heartbeat. |
| **Directory URL** | Set `directoryUrl` to your deployed directory (e.g. `https://directory.example.com`). |
| **Directory** | Run behind HTTPS; keep `ORG_PUBLIC_KEY` in env; back up `DB_PATH` (SQLite). |
| **better-sqlite3** | On first install you may need `pnpm approve-builds` (or allow build scripts) in the directory app. |

## Quick reference

| Goal | Command / location |
|------|--------------------|
| Install + build | `pnpm install && pnpm run build` (root) |
| Org keys | `cd packages/moltsapp && pnpm exec tsx scripts/org-keygen.ts` |
| Directory .env | `apps/moltsapp-directory/.env` (ORG_PUBLIC_KEY, PORT, DB_PATH) |
| Start directory | `cd apps/moltsapp-directory && pnpm start` |
| Bot identity | `BOT_ID=bot:xyz pnpm exec tsx scripts/bot-keygen.ts /path/to/workspace` (in packages/moltsapp) |
| Register bot | `ORG_PRIVATE_KEY=... DIRECTORY_URL=http://localhost:7777 BOT_ID=bot:xyz pnpm exec tsx scripts/register-bot.ts /path/to/workspace` (in packages/moltsapp) |
| Sign body (manual) | `ORG_PRIVATE_KEY=base64... pnpm exec tsx scripts/org-sign.ts < register-body.json` |
| Register (manual) | `POST /v1/bots/register` with `x-org-sig` and JSON body |
