/**
 * Plaintext message types inside the ciphertext envelope.
 * Never log plaintext content.
 */

export type PlaintextSubtype = "msg" | "query" | "answer" | "control";

export interface PlaintextMsg {
  text: string;
  kind: "text";
}

export interface PlaintextQuery {
  queryId: string;
  topic: string;
  payload: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  replyTo: { botId: string };
}

export interface PlaintextAnswer {
  queryId: string;
  payload: Record<string, unknown>;
  confidence: number;
  sources?: unknown[];
}

export type PlaintextPayload =
  | { subtype: "msg"; body: PlaintextMsg }
  | { subtype: "query"; body: PlaintextQuery }
  | { subtype: "answer"; body: PlaintextAnswer }
  | { subtype: "control"; body: Record<string, unknown> };

export function parsePlaintext(bytes: Uint8Array): PlaintextPayload {
  const json = new TextDecoder().decode(bytes);
  const obj = JSON.parse(json) as Record<string, unknown>;
  if (obj.subtype === "msg" && obj.body) {
    return { subtype: "msg", body: obj.body as PlaintextMsg };
  }
  if (obj.subtype === "query" && obj.body) {
    return { subtype: "query", body: obj.body as PlaintextQuery };
  }
  if (obj.subtype === "answer" && obj.body) {
    return { subtype: "answer", body: obj.body as PlaintextAnswer };
  }
  if (obj.subtype === "control" && obj.body) {
    return { subtype: "control", body: obj.body as Record<string, unknown> };
  }
  throw new Error("protocol: unknown plaintext subtype");
}

export function serializePlaintext(payload: PlaintextPayload): Uint8Array {
  const obj = { subtype: payload.subtype, body: payload.body };
  return new TextEncoder().encode(JSON.stringify(obj));
}
