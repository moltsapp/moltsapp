/**
 * Handshake: X25519 shared secret -> HKDF rootKey -> chain keys.
 * Never log keys or plaintext.
 */
import { createHash } from "node:crypto";
import { sodiumReady, SODIUM, KEYBYTES_X25519 } from "./sodium.js";
import { hkdfSha256, hmacSha256, advanceChainKey, deriveMessageKey } from "./kdf.js";

const ROOT_INFO = "moltsapp-root";
const SEND_PREFIX = "send:";
const RECV_PREFIX = "recv:";

function saltFromIds(ourId: string, peerId: string): Uint8Array {
  const h = createHash("sha256");
  const [id1, id2] = ourId < peerId ? [ourId, peerId] : [peerId, ourId];
  h.update(id1);
  h.update(id2);
  return new Uint8Array(h.digest());
}

/**
 * X25519 shared secret: ourSecret * peerPublic
 */
async function sharedSecret(ourSecret: Uint8Array, peerPublic: Uint8Array): Promise<Uint8Array> {
  await sodiumReady();
  if (ourSecret.length !== KEYBYTES_X25519 || peerPublic.length !== KEYBYTES_X25519) {
    throw new Error("handshake: invalid key length");
  }
  return SODIUM.crypto_scalarmult(ourSecret, peerPublic);
}

/**
 * Derive root key from shared secret and ids.
 */
export async function deriveRootKey(
  sharedSecretBytes: Uint8Array,
  ourId: string,
  peerId: string
): Promise<Uint8Array> {
  const salt = saltFromIds(ourId, peerId);
  return hkdfSha256(sharedSecretBytes, salt, ROOT_INFO, 32);
}

/**
 * Derive sending chain key: HMAC(rootKey, "send:"+ourId+"->"+peerId)
 */
export function deriveChainKeySend(rootKey: Uint8Array, ourId: string, peerId: string): Uint8Array {
  const info = SEND_PREFIX + ourId + "->" + peerId;
  return hmacSha256(rootKey, Buffer.from(info, "utf8"));
}

/**
 * Derive receiving chain key: same as peer's send chain so we can decrypt.
 * HMAC(rootKey, "send:"+peerId+"->"+ourId)
 */
export function deriveChainKeyRecv(rootKey: Uint8Array, ourId: string, peerId: string): Uint8Array {
  const info = SEND_PREFIX + peerId + "->" + ourId;
  return hmacSha256(rootKey, Buffer.from(info, "utf8"));
}

export interface HandshakeResult {
  rootKey: Uint8Array;
  chainKeySend: Uint8Array;
  chainKeyRecv: Uint8Array;
}

/**
 * Establish session: use our identity secret + peer's signed prekey (or OPK).
 * Returns rootKey and initial chain keys.
 */
export async function establishSession(
  ourId: string,
  peerId: string,
  ourIdentitySecret: Uint8Array,
  peerPrekeyPublic: Uint8Array
): Promise<HandshakeResult> {
  const secret = await sharedSecret(ourIdentitySecret, peerPrekeyPublic);
  const rootKey = await deriveRootKey(secret, ourId, peerId);
  const chainKeySend = deriveChainKeySend(rootKey, ourId, peerId);
  const chainKeyRecv = deriveChainKeyRecv(rootKey, ourId, peerId);
  return { rootKey, chainKeySend, chainKeyRecv };
}

export { advanceChainKey, deriveMessageKey };
