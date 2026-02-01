/**
 * Local keystore: identity keypair + botId, encrypted at rest with MOLTSAPP_PASSPHRASE.
 * AES-256-GCM via Node crypto, PBKDF2 for key derivation.
 * Never log keys or passphrase.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ALG = "aes-256-gcm";
const KEYLEN = 32;
const IVLEN = 16;
const TAGLEN = 16;
const SALT_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

const ENV_PASSPHRASE = "MOLTSAPP_PASSPHRASE";

export interface IdentityKeys {
  botId: string;
  publicKey: string;
  secretKey: string;
}

function getPassphrase(): string | undefined {
  return process.env[ENV_PASSPHRASE];
}

export function warnIfNoPassphrase(): void {
  if (!getPassphrase()) {
    console.warn("[moltsapp] MOLTSAPP_PASSPHRASE is not set; keystore will be stored unencrypted. Set it for production.");
  }
}

function deriveKey(passphrase: string, salt: Uint8Array): Buffer {
  return scryptSync(passphrase, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

function encryptAtRest(plaintext: string, passphrase: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IVLEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([salt, iv, tag, enc]);
  return combined.toString("base64");
}

function decryptAtRest(b64: string, passphrase: string): string {
  const combined = Buffer.from(b64, "base64");
  if (combined.length < SALT_LEN + IVLEN + TAGLEN) throw new Error("keystore: invalid ciphertext");
  const salt = combined.subarray(0, SALT_LEN);
  const iv = combined.subarray(SALT_LEN, SALT_LEN + IVLEN);
  const tag = combined.subarray(SALT_LEN + IVLEN, SALT_LEN + IVLEN + TAGLEN);
  const enc = combined.subarray(SALT_LEN + IVLEN + TAGLEN);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

export class Keystore {
  constructor(private readonly baseDir: string) {}

  private identityPath(): string {
    return join(this.baseDir, "identity.json");
  }

  loadIdentity(): IdentityKeys | null {
    const path = this.identityPath();
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf8");
    const passphrase = getPassphrase();
    let json: string;
    if (passphrase) {
      json = decryptAtRest(raw, passphrase);
    } else {
      try {
        JSON.parse(raw);
        json = raw;
      } catch {
        throw new Error("keystore: identity is encrypted but MOLTSAPP_PASSPHRASE is not set");
      }
    }
    return JSON.parse(json) as IdentityKeys;
  }

  saveIdentity(identity: IdentityKeys): void {
    mkdirSync(dirname(this.identityPath()), { recursive: true });
    const json = JSON.stringify(identity);
    const passphrase = getPassphrase();
    const toWrite = passphrase ? encryptAtRest(json, passphrase) : json;
    writeFileSync(this.identityPath(), toWrite, "utf8");
  }

  getBotId(): string | null {
    const id = this.loadIdentity();
    return id?.botId ?? null;
  }

  getIdentityKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } | null {
    const id = this.loadIdentity();
    if (!id) return null;
    const decoder = new TextDecoder();
    return {
      publicKey: Uint8Array.from(Buffer.from(id.publicKey, "base64")),
      secretKey: Uint8Array.from(Buffer.from(id.secretKey, "base64")),
    };
  }
}
