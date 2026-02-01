#!/usr/bin/env npx tsx
/**
 * Generate ORG Ed25519 keypair for directory signature verification.
 * Prints base64 public and private key.
 */
import nacl from "tweetnacl";

function toBase64(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

const keyPair = nacl.sign.keyPair();
console.log("ORG_PUBLIC_KEY=" + toBase64(keyPair.publicKey));
console.log("ORG_PRIVATE_KEY=" + toBase64(keyPair.secretKey));
console.log("\nAdd ORG_PUBLIC_KEY to directory .env. Keep ORG_PRIVATE_KEY secret.");
