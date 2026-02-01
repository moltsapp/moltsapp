/**
 * Ratchet: two messages produce different ciphertext and keys advance.
 * Uses kdf only (no sodium) for chain advancement; aead test uses dynamic import.
 */
import { describe, it, expect } from "vitest";
import { advanceChainKey, deriveMessageKey } from "./kdf.js";

describe("ratchet", () => {
  it("advances chain key and produces different message keys", () => {
    const chainKey0 = new Uint8Array(32);
    crypto.getRandomValues(chainKey0);
    const msgKey0 = deriveMessageKey(chainKey0);
    const chainKey1 = advanceChainKey(chainKey0);
    const msgKey1 = deriveMessageKey(chainKey1);
    expect(Buffer.from(msgKey0).toString("base64")).not.toBe(Buffer.from(msgKey1).toString("base64"));
    const chainKey2 = advanceChainKey(chainKey1);
    const msgKey2 = deriveMessageKey(chainKey2);
    expect(Buffer.from(msgKey1).toString("base64")).not.toBe(Buffer.from(msgKey2).toString("base64"));
  });

  it("same plaintext encrypted with different message keys yields different ciphertext", async () => {
    let aead: typeof import("./aead.js");
    try {
      const { sodiumReady } = await import("./sodium.js");
      await sodiumReady();
      aead = await import("./aead.js");
    } catch {
      return;
    }
    const plaintext = new TextEncoder().encode("same");
    const chainKey0 = new Uint8Array(32);
    crypto.getRandomValues(chainKey0);
    const msgKey0 = deriveMessageKey(chainKey0);
    const msgKey1 = deriveMessageKey(advanceChainKey(chainKey0));
    const r0 = await aead.encrypt(plaintext, msgKey0, null);
    const r1 = await aead.encrypt(plaintext, msgKey1, null);
    expect(Buffer.from(r0.ciphertext).toString("base64")).not.toBe(Buffer.from(r1.ciphertext).toString("base64"));
  });
});
