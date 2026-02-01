#!/usr/bin/env npx tsx
/**
 * Register a bot with the directory: build body, sign exact bytes, POST same bytes.
 * Guarantees byte-for-byte consistency so org signature verifies.
 *
 * Usage:
 *   ORG_PRIVATE_KEY=base64... DIRECTORY_URL=http://localhost:7777 \
 *   BOT_ID=bot:price-oracle-1 pnpm exec tsx scripts/register-bot.ts [workspaceDir]
 *
 * Optional env: DISPLAY_NAME, CAPABILITIES (comma), TOPICS (comma), SESSION_KEY_HINT
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nacl from "tweetnacl";

const ORG_PRIVATE_KEY = process.env.ORG_PRIVATE_KEY;
const DIRECTORY_URL = (process.env.DIRECTORY_URL ?? "http://localhost:7777").replace(/\/$/, "");
const BOT_ID = process.env.BOT_ID ?? "bot:local-1";
const WORKSPACE = process.argv[2] ?? process.cwd();
const DISPLAY_NAME = process.env.DISPLAY_NAME ?? BOT_ID;
const CAPABILITIES = (process.env.CAPABILITIES ?? "price_oracle").split(",").map((s) => s.trim()).filter(Boolean);
const TOPICS = (process.env.TOPICS ?? "sol,bonk").split(",").map((s) => s.trim()).filter(Boolean);
const SESSION_KEY_HINT = process.env.SESSION_KEY_HINT ?? `moltmesh:${BOT_ID}`;

interface IdentityJson {
  botId: string;
  publicKey: string;
  secretKey: string;
}

async function main(): Promise<void> {
  if (!ORG_PRIVATE_KEY) {
    console.error("ORG_PRIVATE_KEY env required");
    process.exit(1);
  }
  const identityPath = join(WORKSPACE, ".moltsapp", "identity.json");
  let identity: IdentityJson;
  try {
    identity = JSON.parse(readFileSync(identityPath, "utf8")) as IdentityJson;
  } catch (e: unknown) {
    console.error("Read identity failed:", (e as Error).message, "at", identityPath);
    process.exit(1);
  }
  if (!identity.publicKey) {
    console.error("identity.json missing publicKey");
    process.exit(1);
  }

  const body = {
    botId: BOT_ID,
    displayName: DISPLAY_NAME,
    capabilities: CAPABILITIES,
    topics: TOPICS,
    reachability: {
      transport: "openclaw",
      sessionKeyHint: SESSION_KEY_HINT,
    },
    keys: {
      identityPub: identity.publicKey,
      signedPrekeyPub: identity.publicKey,
      oneTimePrekeysPub: [] as string[],
    },
    meta: { env: "prod", version: "1.0.0" },
  };

  const bodyString = JSON.stringify(body);
  const secretKey = Buffer.from(ORG_PRIVATE_KEY, "base64");
  if (secretKey.length !== nacl.sign.secretKeyLength) {
    console.error("invalid ORG_PRIVATE_KEY length");
    process.exit(1);
  }
  const signature = nacl.sign.detached(
    Buffer.from(bodyString, "utf8"),
    new Uint8Array(secretKey)
  );
  const sigB64 = Buffer.from(signature).toString("base64");

  const url = `${DIRECTORY_URL}/v1/bots/register`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-org-sig": sigB64,
    },
    body: bodyString,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Register failed:", res.status, text);
    process.exit(1);
  }
  console.log("Registered:", text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
