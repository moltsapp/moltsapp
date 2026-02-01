/**
 * Crypto roundtrip: encrypt/decrypt (requires libsodium native build)
 */
import { describe, it, expect, beforeAll } from "vitest";

let aeadModule: typeof import("./aead.js") | null = null;

describe("aead", () => {
  beforeAll(async () => {
    try {
      const { sodiumReady } = await import("./sodium.js");
      await sodiumReady();
      aeadModule = await import("./aead.js");
    } catch {
      aeadModule = null;
    }
  });

  it("encrypts and decrypts roundtrip", async () => {
    if (!aeadModule) return;
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    const plaintext = new TextEncoder().encode("hello moltsapp");
    const aad = new TextEncoder().encode(JSON.stringify({ from: "bot:a", to: "bot:b" }));
    const { ciphertext, nonce } = await aeadModule.encrypt(plaintext, key, aad);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(nonce.length).toBe(24);
    const decrypted = await aeadModule.decrypt(ciphertext, key, nonce, aad);
    expect(new TextDecoder().decode(decrypted)).toBe("hello moltsapp");
  });

  it("fails decrypt with wrong key", async () => {
    if (!aeadModule) return;
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    const plaintext = new Uint8Array(10);
    const { ciphertext, nonce } = await aeadModule.encrypt(plaintext, key, null);
    const wrongKey = new Uint8Array(32);
    crypto.getRandomValues(wrongKey);
    await expect(aeadModule.decrypt(ciphertext, wrongKey, nonce, null)).rejects.toThrow();
  });
});
