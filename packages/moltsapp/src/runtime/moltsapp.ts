/**
 * Main orchestrator: directory, transport, session state, envelope send/recv, query/answer.
 * Never log plaintext or secret keys; allow logging botId, peerBotId, subtype, message counts.
 */
import { establishSession, advanceChainKey, deriveMessageKey } from "../crypto/handshake.js";
import * as aead from "../crypto/aead.js";
import { shortHash } from "../crypto/kdf.js";
import { Keystore, warnIfNoPassphrase } from "../state/keystore.js";
import { SessionStore, type SessionState } from "../state/sessionStore.js";
import { DirectoryClient, type BotProfile, type PrekeyBundle, type RegisterBody } from "../directory/client.js";
import type { Transport } from "../transport/transport.js";
import { isMoltsappEnvelope, envelopeAad, type MoltsappEnvelope, type EnvelopeSubtype } from "../protocol/envelope.js";
import {
  parsePlaintext,
  serializePlaintext,
  type PlaintextPayload,
  type PlaintextQuery,
  type PlaintextAnswer,
  type PlaintextMsg,
} from "../protocol/messages.js";

const ENVELOPE_VERSION = 1;
const SESSION_ID_PREFIX = "moltsapp:";

export interface MoltsappConfig {
  workspaceDir: string;
  directoryUrl: string;
  transport: Transport;
  directoryClient?: DirectoryClient;
}

export type MessageHandler = (params: {
  fromBotId: string;
  subtype: EnvelopeSubtype;
  plaintext: PlaintextPayload;
}) => void;

export interface FindOptions {
  capability?: string;
  topic?: string;
  q?: string;
  limit?: number;
}

export interface QueryRequest {
  topic: string;
  payload?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

const queryPromises = new Map<
  string,
  { resolve: (value: PlaintextAnswer) => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }
>();
const pendingQueryReplyTo = new Map<string, string>();

function generateQueryId(): string {
  return "q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

export class Moltsapp {
  private readonly keystore: Keystore;
  private readonly sessionStore: SessionStore;
  private readonly directory: DirectoryClient;
  private readonly transport: Transport;
  private readonly ourBotId: string;
  private messageHandler: MessageHandler | null = null;
  private sessionId: string;

  constructor(config: MoltsappConfig) {
    const baseDir = `${config.workspaceDir}/.moltsapp`;
    this.keystore = new Keystore(baseDir);
    this.sessionStore = new SessionStore(`${baseDir}/sessions`);
    this.directory = config.directoryClient ?? new DirectoryClient(config.directoryUrl);
    this.transport = config.transport;
    const identity = this.keystore.loadIdentity();
    if (!identity) throw new Error("moltsapp: no identity; run bot-keygen and register first");
    this.ourBotId = identity.botId;
    this.sessionId = SESSION_ID_PREFIX + this.ourBotId + ":" + Date.now();
    warnIfNoPassphrase();
    this.transport.onMessage((fromSessionKey, payload) => {
      if (!isMoltsappEnvelope(payload)) return;
      void this.handleIncoming(fromSessionKey, payload);
    });
  }

  getBotId(): string {
    return this.ourBotId;
  }

  async ensureSession(peerBotId: string, peerIdentityPub: string, peerPrekeyPub: string): Promise<void> {
    const existing = this.sessionStore.load(peerBotId);
    if (existing) {
      if (existing.peerIdentityPub !== peerIdentityPub) {
        console.error("[moltsapp] key pinning violation: peer identity changed", { peerBotId });
        throw new Error("moltsapp: peer identity changed; refusing");
      }
      return;
    }
    const kp = this.keystore.getIdentityKeyPair();
    if (!kp) throw new Error("moltsapp: no identity keypair");
    const peerPrekeyBytes = Buffer.from(peerPrekeyPub, "base64");
    const result = await establishSession(this.ourBotId, peerBotId, kp.secretKey, peerPrekeyBytes);
    const state: SessionState = {
      peerBotId,
      peerIdentityPub,
      rootKey: Buffer.from(result.rootKey).toString("base64"),
      chainKeySend: Buffer.from(result.chainKeySend).toString("base64"),
      chainKeyRecv: Buffer.from(result.chainKeyRecv).toString("base64"),
      msgNumSend: 0,
      msgNumRecv: 0,
    };
    this.sessionStore.save(state);
  }

  private async sendEnvelope(
    toBotId: string,
    subtype: EnvelopeSubtype,
    plaintext: PlaintextPayload,
    aad?: Record<string, unknown>
  ): Promise<void> {
    const profile = await this.directory.getBot(toBotId);
    if (!profile) throw new Error("moltsapp: bot not found " + toBotId);
    const bundle = await this.directory.getPrekeyBundle(toBotId);
    const peerPrekey = bundle.oneTimePrekeyPub
      ? Buffer.from(bundle.oneTimePrekeyPub, "base64")
      : Buffer.from(bundle.signedPrekeyPub, "base64");
    await this.ensureSession(toBotId, bundle.identityPub, peerPrekey.toString("base64"));
    const session = this.sessionStore.load(toBotId);
    if (!session) throw new Error("moltsapp: session not persisted");
    const chainKeySend = Buffer.from(session.chainKeySend, "base64");
    const messageKey = deriveMessageKey(chainKeySend);
    const nextChainKey = advanceChainKey(chainKeySend);
    const plaintextBytes = serializePlaintext(plaintext);
    const aadObj = aad ?? {};
    const aadBytes = new TextEncoder().encode(JSON.stringify(aadObj));
    const { ciphertext, nonce } = await aead.encrypt(plaintextBytes, messageKey, aadBytes);
    const n = session.msgNumSend;
    const ckh = shortHash(nextChainKey);
    this.sessionStore.save({
      ...session,
      chainKeySend: Buffer.from(nextChainKey).toString("base64"),
      msgNumSend: n + 1,
    });
    const sessionKey = await this.transport.resolveSessionKeyForBot(
      toBotId,
      profile.reachability.sessionKeyHint
    );
    const envelope: MoltsappEnvelope = {
      v: ENVELOPE_VERSION,
      type: "moltsapp",
      subtype,
      from: this.ourBotId,
      to: toBotId,
      sid: this.sessionId,
      ts: Math.floor(Date.now() / 1000),
      ratchet: { n, ckh },
      ciphertext: Buffer.from(ciphertext).toString("base64"),
      nonce: Buffer.from(nonce).toString("base64"),
      aad: aadObj,
    };
    await this.transport.send(sessionKey, envelope);
  }

  private async handleIncoming(fromSessionKey: string, envelope: MoltsappEnvelope): Promise<void> {
    const peerBotId = envelope.from;
    if (peerBotId === this.ourBotId) return;
    let session = this.sessionStore.load(peerBotId);
    if (!session) {
      try {
        const bundle = await this.directory.getPrekeyBundle(peerBotId);
        const peerPrekeyPub = bundle.identityPub;
        await this.ensureSession(peerBotId, bundle.identityPub, peerPrekeyPub);
        session = this.sessionStore.load(peerBotId);
      } catch (e) {
        console.warn("[moltsapp] could not establish session for incoming peer", { peerBotId });
        return;
      }
    }
    if (!session) {
      console.warn("[moltsapp] received message from unknown peer", { peerBotId });
      return;
    }
    const n = envelope.ratchet?.n ?? 0;
    let chainKeyRecv = Buffer.from(session.chainKeyRecv, "base64");
    for (let i = 0; i < n; i++) {
      chainKeyRecv = Buffer.from(advanceChainKey(new Uint8Array(chainKeyRecv)));
    }
    const messageKey = deriveMessageKey(new Uint8Array(chainKeyRecv));
    const nextChainKey = Buffer.from(advanceChainKey(new Uint8Array(chainKeyRecv)));
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const nonce = Buffer.from(envelope.nonce, "base64");
    const aad = envelopeAad(envelope);
    let plaintextBytes: Uint8Array;
    try {
      plaintextBytes = await aead.decrypt(
        new Uint8Array(ciphertext),
        messageKey,
        new Uint8Array(nonce),
        aad
      );
    } catch (e) {
      console.warn("[moltsapp] decrypt failed", { peerBotId, subtype: envelope.subtype });
      return;
    }
    this.sessionStore.save({
      ...session,
      chainKeyRecv: nextChainKey.toString("base64"),
      msgNumRecv: (session.msgNumRecv ?? 0) + 1,
    });
    const plaintext = parsePlaintext(plaintextBytes);
    if (plaintext.subtype === "query") {
      pendingQueryReplyTo.set(plaintext.body.queryId, peerBotId);
    }
    if (plaintext.subtype === "answer") {
      const body = plaintext.body;
      const pending = queryPromises.get(body.queryId);
      if (pending) {
        clearTimeout(pending.timeout);
        queryPromises.delete(body.queryId);
        pending.resolve(body);
      }
    }
    if (this.messageHandler) {
      try {
        this.messageHandler({ fromBotId: peerBotId, subtype: envelope.subtype, plaintext });
      } catch (_) {
        // log but don't throw
      }
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async register(profile: RegisterBody, orgSig: string): Promise<{ ok: boolean }> {
    return this.directory.register(profile, orgSig);
  }

  async find(opts: FindOptions): Promise<BotProfile[]> {
    return this.directory.find(opts);
  }

  async send(botId: string, plaintext: string): Promise<void> {
    await this.sendEnvelope(botId, "msg", {
      subtype: "msg",
      body: { text: plaintext, kind: "text" },
    });
  }

  async query(botId: string, request: QueryRequest): Promise<string> {
    const queryId = generateQueryId();
    await this.sendEnvelope(botId, "query", {
      subtype: "query",
      body: {
        queryId,
        topic: request.topic,
        payload: request.payload ?? {},
        constraints: request.constraints,
        replyTo: { botId: this.ourBotId },
      },
    });
    return queryId;
  }

  awaitQueryAnswer(queryId: string, timeoutMs: number): Promise<PlaintextAnswer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (queryPromises.delete(queryId)) reject(new Error("moltsapp: query timeout"));
      }, timeoutMs);
      queryPromises.set(queryId, { resolve, reject, timeout });
    });
  }

  async answer(queryId: string, answer: { payload: Record<string, unknown>; confidence?: number; sources?: unknown[] }): Promise<void> {
    const replyToBotId = pendingQueryReplyTo.get(queryId);
    if (!replyToBotId) throw new Error("moltsapp: unknown queryId or replyTo not stored");
    pendingQueryReplyTo.delete(queryId);
    await this.sendEnvelope(replyToBotId, "answer", {
      subtype: "answer",
      body: {
        queryId,
        payload: answer.payload,
        confidence: answer.confidence ?? 1,
        sources: answer.sources ?? [],
      },
    });
  }
}
