#!/usr/bin/env npx tsx
/**
 * Sign JSON body with ORG private key (Ed25519). For manual testing of directory register/heartbeat.
 * Usage: ORG_PRIVATE_KEY=base64... npx tsx scripts/org-sign.ts < body.json
 * Output: base64 signature (print to stdout; use as x-org-sig header).
 */
import nacl from "tweetnacl";

const ORG_PRIVATE_KEY = process.env.ORG_PRIVATE_KEY;
if (!ORG_PRIVATE_KEY) {
  console.error("ORG_PRIVATE_KEY env required");
  process.exit(1);
}
const keyB64: string = ORG_PRIVATE_KEY;

async function main(): Promise<void> {
  const body = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
  const secretKey = Buffer.from(keyB64, "base64");
  if (secretKey.length !== nacl.sign.secretKeyLength) {
    console.error("invalid ORG_PRIVATE_KEY length");
    process.exit(1);
  }
  const message = Buffer.from(body, "utf8");
  const signature = nacl.sign.detached(message, new Uint8Array(secretKey));
  process.stdout.write(Buffer.from(signature).toString("base64"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
