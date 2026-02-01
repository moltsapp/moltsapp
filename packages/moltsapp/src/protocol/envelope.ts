/**
 * Secure messaging envelope (sent inside sessions_send).
 * Never log plaintext or keys; allow logging botId, peerBotId, subtype, message counts.
 */
export type EnvelopeSubtype = "msg" | "query" | "answer" | "control";

export interface MoltsappEnvelope {
  v: number;
  type: "moltsapp";
  subtype: EnvelopeSubtype;
  from: string;
  to: string;
  sid: string;
  ts: number;
  ratchet?: {
    n: number;
    ckh?: string;
  };
  ciphertext: string;
  nonce: string;
  aad?: Record<string, unknown>;
}

export function isMoltsappEnvelope(payload: unknown): payload is MoltsappEnvelope {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === "moltsapp" &&
    typeof p.v === "number" &&
    typeof p.subtype === "string" &&
    typeof p.from === "string" &&
    typeof p.to === "string" &&
    typeof p.ciphertext === "string" &&
    typeof p.nonce === "string"
  );
}

export function envelopeAad(envelope: MoltsappEnvelope): Uint8Array {
  const aad = envelope.aad ?? {};
  return new TextEncoder().encode(JSON.stringify(aad));
}
