#!/usr/bin/env npx tsx
/**
 * Generate bot X25519 identity keypair and prekeys; write identity to .moltsapp/identity.json.
 * Usage: BOT_ID=bot:my-bot-1 npx tsx scripts/bot-keygen.ts [workspaceDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sodium from "libsodium-wrappers";

const BOT_ID = process.env.BOT_ID ?? "bot:local-1";
const WORKSPACE = process.argv[2] ?? process.cwd();

async function main(): Promise<void> {
  await sodium.ready;
  const identityKeyPair = sodium.crypto_kx_keypair();
  const signedPrekey = sodium.crypto_kx_keypair();
  const oneTimePrekeys: string[] = [];
  for (let i = 0; i < 10; i++) {
    const opk = sodium.crypto_kx_keypair();
    oneTimePrekeys.push(sodium.to_base64(opk.publicKey));
  }
  const identity = {
    botId: BOT_ID,
    publicKey: sodium.to_base64(identityKeyPair.publicKey),
    secretKey: sodium.to_base64(identityKeyPair.privateKey),
  };
  const baseDir = join(WORKSPACE, ".moltsapp");
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(
    join(baseDir, "identity.json"),
    JSON.stringify(identity, null, 2),
    "utf8"
  );
  console.log("Identity written to", join(baseDir, "identity.json"));
  console.log("For directory registration, use keys:");
  console.log("  identityPub:", identity.publicKey);
  console.log("  signedPrekeyPub:", sodium.to_base64(signedPrekey.publicKey));
  console.log("  oneTimePrekeysPub:", JSON.stringify(oneTimePrekeys.slice(0, 5), null, 2), "...");
}

main().catch(console.error);
