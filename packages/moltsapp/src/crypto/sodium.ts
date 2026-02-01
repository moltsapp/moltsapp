/**
 * libsodium loader - never log secret keys or plaintext.
 */
import sodium from "libsodium-wrappers";

let ready = false;

export async function sodiumReady(): Promise<typeof sodium> {
  if (!ready) {
    await sodium.ready;
    ready = true;
  }
  return sodium;
}

export const SODIUM = {
  crypto_kx_client_session_keys: (client_pk: Uint8Array, client_sk: Uint8Array, server_pk: Uint8Array) =>
    sodium.crypto_kx_client_session_keys(client_pk, client_sk, server_pk),
  crypto_kx_server_session_keys: (server_pk: Uint8Array, server_sk: Uint8Array, client_pk: Uint8Array) =>
    sodium.crypto_kx_server_session_keys(server_pk, server_sk, client_pk),
  crypto_scalarmult: (n: Uint8Array, p: Uint8Array) => sodium.crypto_scalarmult(n, p),
  crypto_scalarmult_base: (n: Uint8Array) => sodium.crypto_scalarmult_base(n),
  crypto_generichash: (msg: Uint8Array, key?: Uint8Array | null, outLen?: number) =>
    sodium.crypto_generichash(outLen ?? 32, msg, key ?? null),
  crypto_aead_xchacha20poly1305_ietf_encrypt: (
    message: Uint8Array,
    additionalData: Uint8Array | null,
    secretKey: Uint8Array,
    publicNonce: Uint8Array
  ) => {
    const s = sodium as unknown as { crypto_aead_xchacha20poly1305_ietf_encrypt: (m: Uint8Array, ad: Uint8Array | null, nsec: null, npub: Uint8Array, k: Uint8Array) => Uint8Array };
    return s.crypto_aead_xchacha20poly1305_ietf_encrypt(message, additionalData, null, publicNonce, secretKey);
  },
  crypto_aead_xchacha20poly1305_ietf_decrypt: (
    ciphertext: Uint8Array,
    additionalData: Uint8Array | null,
    secretKey: Uint8Array,
    publicNonce: Uint8Array
  ) => {
    const s = sodium as unknown as { crypto_aead_xchacha20poly1305_ietf_decrypt: (c: Uint8Array, ad: Uint8Array | null, nsec: null, npub: Uint8Array, k: Uint8Array) => Uint8Array };
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(ciphertext, additionalData, null, publicNonce, secretKey);
  },
  crypto_aead_xchacha20poly1305_ietf_keygen: () => sodium.crypto_aead_xchacha20poly1305_ietf_keygen(),
  crypto_aead_xchacha20poly1305_ietf_npubgen: () =>
    (sodium.crypto_aead_xchacha20poly1305_ietf_npubgen?.() ?? sodium.randombytes_buf(24)),
  randombytes_buf: (n: number) => sodium.randombytes_buf(n),
  from_base64: (s: string) => sodium.from_base64(s),
  to_base64: (b: Uint8Array) => sodium.to_base64(b),
};

export type X25519KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };
export const KEYBYTES_X25519 = 32;
export const AEAD_KEYBYTES = 32;
export const AEAD_NPUBBYTES = 24;
