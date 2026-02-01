/**
 * Per-peer session state: rootKey, chainKeySend, chainKeyRecv, msgNumSend, msgNumRecv.
 * Stored under .moltsapp/sessions/<peerBotId>.json, encrypted at rest.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ENV_PASSPHRASE = "MOLTSAPP_PASSPHRASE";

export interface SessionState {
  peerBotId: string;
  peerIdentityPub: string;
  rootKey: string;
  chainKeySend: string;
  chainKeyRecv: string;
  msgNumSend: number;
  msgNumRecv: number;
}

function getPassphrase(): string | undefined {
  return process.env[ENV_PASSPHRASE];
}

const ALG = "aes-256-gcm";
const KEYLEN = 32;
const IVLEN = 16;
const TAGLEN = 16;
const SALT_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

function sessionEncrypt(plaintext: string, passphrase: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IVLEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]).toString("base64");
}

function sessionDecrypt(b64: string, passphrase: string): string {
  const combined = Buffer.from(b64, "base64");
  if (combined.length < SALT_LEN + IVLEN + TAGLEN) throw new Error("sessionStore: invalid ciphertext");
  const salt = combined.subarray(0, SALT_LEN);
  const iv = combined.subarray(SALT_LEN, SALT_LEN + IVLEN);
  const tag = combined.subarray(SALT_LEN + IVLEN, SALT_LEN + IVLEN + TAGLEN);
  const enc = combined.subarray(SALT_LEN + IVLEN + TAGLEN);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

export class SessionStore {
  constructor(private readonly sessionsDir: string) {}

  private sessionPath(peerBotId: string): string {
    const safe = Buffer.from(peerBotId, "utf8").toString("base64url");
    return join(this.sessionsDir, `${safe}.json`);
  }

  load(peerBotId: string): SessionState | null {
    const path = this.sessionPath(peerBotId);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf8");
    const passphrase = getPassphrase();
    let json: string;
    if (passphrase) {
      json = sessionDecrypt(raw, passphrase);
    } else {
      try {
        JSON.parse(raw);
        json = raw;
      } catch {
        throw new Error("sessionStore: session is encrypted but MOLTSAPP_PASSPHRASE is not set");
      }
    }
    return JSON.parse(json) as SessionState;
  }

  save(state: SessionState): void {
    mkdirSync(dirname(this.sessionPath(state.peerBotId)), { recursive: true });
    const json = JSON.stringify(state);
    const passphrase = getPassphrase();
    const toWrite = passphrase ? sessionEncrypt(json, passphrase) : json;
    writeFileSync(this.sessionPath(state.peerBotId), toWrite, "utf8");
  }

  listPeerBotIds(): string[] {
    if (!existsSync(this.sessionsDir)) return [];
    return readdirSync(this.sessionsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const b64 = f.replace(/\.json$/, "");
        try {
          return Buffer.from(b64, "base64url").toString("utf8");
        } catch {
          return "";
        }
      })
      .filter(Boolean);
  }
}
