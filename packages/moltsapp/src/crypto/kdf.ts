/**
 * HKDF-SHA256 and HMAC-SHA256 using Node crypto.
 * Never log inputs that may be secret.
 */
import { createHmac, hkdfSync } from "node:crypto";

const HMAC_KEY = "ck";
const MSG_KEY = "mk";

export function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: string, length = 32): Uint8Array {
  const buf = hkdfSync("sha256", ikm, salt, Buffer.from(info, "utf8"), length);
  return new Uint8Array(buf);
}

export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const h = createHmac("sha256", Buffer.from(key));
  h.update(Buffer.from(data));
  return new Uint8Array(h.digest());
}

/**
 * Advance chain key: nextChainKey = HMAC-SHA256(chainKey, "ck")
 */
export function advanceChainKey(chainKey: Uint8Array): Uint8Array {
  return hmacSha256(chainKey, Buffer.from(HMAC_KEY, "utf8"));
}

/**
 * Derive message key from chain key: messageKey = HMAC-SHA256(chainKey, "mk")
 */
export function deriveMessageKey(chainKey: Uint8Array): Uint8Array {
  return hmacSha256(chainKey, Buffer.from(MSG_KEY, "utf8"));
}

/**
 * Short hash for debugging only (e.g. ckh in envelope). Never use for security.
 */
export function shortHash(data: Uint8Array, len = 8): string {
  const h = createHmac("sha256", Buffer.from("moltsapp-debug"));
  h.update(Buffer.from(data));
  return h.digest("base64").slice(0, len);
}
