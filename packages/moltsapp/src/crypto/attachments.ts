/**
 * Encrypted attachment helpers (MVP: no S3/storage wiring).
 * encryptAttachmentBytes / decryptAttachmentBytes.
 * Never log plaintext or keys.
 */
import { randomBytes } from "node:crypto";
import { sodiumReady, SODIUM, AEAD_KEYBYTES, AEAD_NPUBBYTES } from "./sodium.js";
import { createHash } from "node:crypto";

export interface EncryptedAttachment {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  key: Uint8Array;
  sha256: string;
}

export async function encryptAttachmentBytes(bytes: Uint8Array): Promise<EncryptedAttachment> {
  await sodiumReady();
  const key = SODIUM.crypto_aead_xchacha20poly1305_ietf_keygen();
  const nonce = SODIUM.crypto_aead_xchacha20poly1305_ietf_npubgen();
  const ciphertext = SODIUM.crypto_aead_xchacha20poly1305_ietf_encrypt(
    bytes,
    null,
    key,
    nonce
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { ciphertext, nonce, key, sha256 };
}

export async function decryptAttachmentBytes(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  expectedSha256?: string
): Promise<Uint8Array> {
  await sodiumReady();
  if (key.length !== AEAD_KEYBYTES || nonce.length !== AEAD_NPUBBYTES) {
    throw new Error("attachments: invalid key or nonce length");
  }
  const plaintext = SODIUM.crypto_aead_xchacha20poly1305_ietf_decrypt(
    ciphertext,
    null,
    key,
    nonce
  );
  if (expectedSha256) {
    const actual = createHash("sha256").update(plaintext).digest("hex");
    if (actual !== expectedSha256) throw new Error("attachments: sha256 mismatch");
  }
  return plaintext;
}
