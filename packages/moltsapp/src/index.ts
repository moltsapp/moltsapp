/**
 * moltsapp: end-to-end encrypted bot messaging layer.
 */
import type { Transport } from "./transport/transport.js";
import { Moltsapp } from "./runtime/moltsapp.js";
import type { MoltsappConfig, MessageHandler, FindOptions, QueryRequest } from "./runtime/moltsapp.js";
import type { RegisterBody } from "./directory/client.js";

export { Moltsapp, type MoltsappConfig, type MessageHandler, type FindOptions, type QueryRequest } from "./runtime/moltsapp.js";
export type { Transport } from "./transport/transport.js";
export { MockTransport, type MockTransportOptions } from "./transport/mockTransport.js";
export { OpenClawTransport } from "./transport/openclawTransport.js";
export type { BotProfile, PrekeyBundle, RegisterBody, Reachability, BotKeys } from "./directory/client.js";
export { DirectoryClient } from "./directory/client.js";
export { MockDirectoryClient } from "./directory/mockDirectory.js";
export { Keystore, warnIfNoPassphrase, type IdentityKeys } from "./state/keystore.js";
export { SessionStore, type SessionState } from "./state/sessionStore.js";
export type { MoltsappEnvelope, EnvelopeSubtype } from "./protocol/envelope.js";
export { isMoltsappEnvelope } from "./protocol/envelope.js";
export type { PlaintextPayload, PlaintextMsg, PlaintextQuery, PlaintextAnswer } from "./protocol/messages.js";
export { encryptAttachmentBytes, decryptAttachmentBytes, type EncryptedAttachment } from "./crypto/attachments.js";

/**
 * Tool adapter: create a Moltsapp instance and expose bot-facing functions.
 * moltsapp_register(profile), moltsapp_find(query), moltsapp_query(botId, request),
 * moltsapp_answer(queryId, answer), moltsapp_send(botId, plaintext), moltsapp_onMessage(handler).
 */
export function createMoltsappAdapter(config: MoltsappConfig) {
  const moltsapp = new Moltsapp(config);
  return {
    moltsapp,
    moltsapp_register: (profile: RegisterBody, orgSig: string) => moltsapp.register(profile, orgSig),
    moltsapp_find: (query: FindOptions) => moltsapp.find(query),
    moltsapp_query: (botId: string, request: QueryRequest) => moltsapp.query(botId, request),
    moltsapp_answer: (
      queryId: string,
      answer: { payload: Record<string, unknown>; confidence?: number; sources?: unknown[] }
    ) => moltsapp.answer(queryId, answer),
    moltsapp_send: (botId: string, plaintext: string) => moltsapp.send(botId, plaintext),
    moltsapp_onMessage: (handler: MessageHandler) => moltsapp.onMessage(handler),
    awaitQueryAnswer: (queryId: string, timeoutMs: number) =>
      moltsapp.awaitQueryAnswer(queryId, timeoutMs),
  };
}
