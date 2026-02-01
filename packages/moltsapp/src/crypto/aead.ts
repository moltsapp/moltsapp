/**
 * XChaCha20-Poly1305 encrypt/decrypt via libsodium.
 * Never log plaintext or keys.
 */
import { sodiumReady, SODIUM, AEAD_KEYBYTES, AEAD_NPUBBYTES } from "./sodium.js";

export async function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array | null
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  await sodiumReady();
  if (key.length !== AEAD_KEYBYTES) throw new Error("aead: key must be 32 bytes");
  const nonce = SODIUM.crypto_aead_xchacha20poly1305_ietf_npubgen();
  const ciphertext = SODIUM.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    aad,
    key,
    nonce
  );
  return { ciphertext, nonce };
}

export async function decrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array | null
): Promise<Uint8Array> {
  await sodiumReady();
  if (key.length !== AEAD_KEYBYTES) throw new Error("aead: key must be 32 bytes");
  if (nonce.length !== AEAD_NPUBBYTES) throw new Error("aead: nonce must be 24 bytes");
  return SODIUM.crypto_aead_xchacha20poly1305_ietf_decrypt(
    ciphertext,
    aad,
    key,
    nonce
  );
}
