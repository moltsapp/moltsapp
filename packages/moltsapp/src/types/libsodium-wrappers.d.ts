declare module "libsodium-wrappers" {
  const sodium: {
    ready: Promise<void>;
    crypto_kx_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
    crypto_kx_client_session_keys(pk: Uint8Array, sk: Uint8Array, serverPk: Uint8Array): { sharedRx: Uint8Array; sharedTx: Uint8Array };
    crypto_kx_server_session_keys(pk: Uint8Array, sk: Uint8Array, clientPk: Uint8Array): { sharedRx: Uint8Array; sharedTx: Uint8Array };
    crypto_scalarmult(n: Uint8Array, p: Uint8Array): Uint8Array;
    crypto_scalarmult_base(n: Uint8Array): Uint8Array;
    crypto_generichash(length: number, msg: Uint8Array, key?: Uint8Array | null): Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_encrypt(message: Uint8Array, ad: Uint8Array | null, secret_key: Uint8Array, public_nonce: Uint8Array): Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_decrypt(ciphertext: Uint8Array, ad: Uint8Array | null, secret_key: Uint8Array, public_nonce: Uint8Array): Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_npubgen(): Uint8Array;
    randombytes_buf(n: number): Uint8Array;
    to_base64(b: Uint8Array): string;
    from_base64(s: string): Uint8Array;
    base64_variants: { ORIGINAL: number };
  };
  export default sodium;
}
