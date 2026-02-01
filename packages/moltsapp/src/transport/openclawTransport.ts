/**
 * OpenClaw transport adapter: wraps sessions_send and message receive.
 * If no event hook is available, uses polling fallback (sessions_list + sessions_history).
 * TODO: Wire to actual OpenClaw runtime when available; this stub documents the interface.
 */
import type { Transport } from "./transport.js";

export interface OpenClawSessionAPI {
  sessions_send?(sessionKey: string, payload: unknown): Promise<void>;
  sessions_list?(): Promise<{ sessionKey: string }[]>;
  sessions_history?(sessionKey: string, options?: { since?: string; limit?: number }): Promise<
    { id: string; ts: number; payload: unknown }[]
  >;
}

const POLL_INTERVAL_MS = 3000;

/**
 * OpenClawTransport: requires an injectable session API.
 * - If onMessageHook is provided, registers there and uses send for outgoing.
 * - Otherwise falls back to polling: sessions_list + sessions_history, tracking last processed id per session.
 */
export class OpenClawTransport implements Transport {
  private handlers: ((fromSessionKey: string, payload: unknown) => void)[] = [];
  private lastProcessed: Map<string, string> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: OpenClawSessionAPI,
    private readonly options?: {
      onMessageHook?: (handler: (fromSessionKey: string, payload: unknown) => void) => void;
      pollIntervalMs?: number;
    }
  ) {}

  send(toSessionKey: string, payload: unknown): Promise<void> {
    const send = this.api.sessions_send;
    if (!send) {
      return Promise.reject(new Error("openclaw: sessions_send not available"));
    }
    return send(toSessionKey, payload);
  }

  onMessage(handler: (fromSessionKey: string, payload: unknown) => void): void {
    this.handlers.push(handler);
    if (this.options?.onMessageHook && this.handlers.length === 1) {
      this.options.onMessageHook((from, payload) => {
        for (const h of this.handlers) h(from, payload);
      });
    } else if (!this.options?.onMessageHook && this.handlers.length === 1) {
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollTimer != null) return;
    const interval = this.options?.pollIntervalMs ?? POLL_INTERVAL_MS;
    this.pollTimer = setInterval(() => this.poll(), interval);
  }

  private async poll(): Promise<void> {
    const list = this.api.sessions_list;
    const history = this.api.sessions_history;
    if (!list || !history) return;
    try {
      const sessions = await list();
      for (const { sessionKey } of sessions) {
        const since = this.lastProcessed.get(sessionKey);
        const messages = await history(sessionKey, { since, limit: 50 });
        for (const msg of messages) {
          this.lastProcessed.set(sessionKey, msg.id);
          for (const h of this.handlers) {
            try {
              h(sessionKey, msg.payload);
            } catch (_) {
              // log but don't throw
            }
          }
        }
      }
    } catch (_) {
      // avoid unhandled rejection
    }
  }

  stopPolling(): void {
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async resolveSessionKeyForBot(botId: string, hint?: string): Promise<string> {
    if (hint) return hint;
    // TODO: When OpenClaw exposes a lookup, use it. For now return conventional key.
    return `moltmesh:${botId}`;
  }
}
