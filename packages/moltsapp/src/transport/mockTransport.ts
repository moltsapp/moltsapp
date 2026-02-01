/**
 * Mock transport for demos and tests: in-memory routing by session key.
 * Never log plaintext.
 */
import type { Transport } from "./transport.js";

type Handler = (fromSessionKey: string, payload: unknown) => void;

export interface MockTransportOptions {
  /** When send() is called, used as fromSessionKey when delivering to receiver. */
  getSender?: () => string;
}

export class MockTransport implements Transport {
  private handlers: Handler[] = [];
  private readonly sessions = new Map<string, Handler[]>();
  constructor(private readonly options: MockTransportOptions = {}) {}

  registerSession(sessionKey: string): void {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, []);
    }
  }

  send(toSessionKey: string, payload: unknown): Promise<void> {
    const fromSessionKey = this.options.getSender?.() ?? "unknown";
    const list = this.sessions.get(toSessionKey);
    if (list) {
      for (const h of list) {
        try {
          h(fromSessionKey, payload);
        } catch (_) {
          // ignore
        }
      }
    }
    for (const h of this.handlers) {
      try {
        h(fromSessionKey, payload);
      } catch (_) {
        // ignore
      }
    }
    return Promise.resolve();
  }

  onMessage(handler: Handler): void {
    this.handlers.push(handler);
  }

  resolveSessionKeyForBot(botId: string, hint?: string): Promise<string> {
    const key = hint ?? `moltmesh:${botId}`;
    if (!this.sessions.has(key)) {
      this.sessions.set(key, []);
    }
    return Promise.resolve(key);
  }

  /** Deliver a message to a session as if from another session (for testing). */
  deliver(fromSessionKey: string, toSessionKey: string, payload: unknown): void {
    const list = this.sessions.get(toSessionKey);
    if (list) {
      for (const h of list) {
        try {
          h(fromSessionKey, payload);
        } catch (_) {
          // ignore
        }
      }
    }
    for (const h of this.handlers) {
      try {
        h(fromSessionKey, payload);
      } catch (_) {
        // ignore
      }
    }
  }

  /** Subscribe a session to receive messages (call from "bot" that owns that session). */
  subscribe(sessionKey: string, handler: Handler): void {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, []);
    }
    this.sessions.get(sessionKey)!.push(handler);
  }

  /** Create a transport view that uses the given session key as sender (for linked bots). */
  withSender(sessionKey: string): Transport {
    const self = this;
    return {
      send(to: string, payload: unknown) {
        const fromSessionKey = sessionKey;
        const list = self.sessions.get(to);
        if (list) {
          for (const h of list) {
            try {
              h(fromSessionKey, payload);
            } catch (_) {}
          }
        }
        for (const h of self.handlers) {
          try {
            h(fromSessionKey, payload);
          } catch (_) {}
        }
        return Promise.resolve();
      },
      onMessage(handler: Handler) {
        self.handlers.push(handler);
      },
      resolveSessionKeyForBot(botId: string, hint?: string) {
        const key = hint ?? `moltmesh:${botId}`;
        if (!self.sessions.has(key)) self.sessions.set(key, []);
        return Promise.resolve(key);
      },
    };
  }
}
