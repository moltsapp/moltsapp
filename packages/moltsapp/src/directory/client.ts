/**
 * Directory client: register, search, prekey-bundle.
 * Cache results with TTL 60s for find.
 */
export interface Reachability {
  transport: string;
  sessionKeyHint?: string;
}

export interface BotKeys {
  identityPub: string;
  signedPrekeyPub: string;
  signedPrekeySig?: string;
  oneTimePrekeysPub?: string[];
}

export interface BotProfile {
  botId: string;
  displayName: string;
  capabilities: string[];
  topics: string[];
  reachability: Reachability;
  keys: BotKeys;
  meta?: Record<string, unknown>;
  lastSeen?: number;
}

export interface PrekeyBundle {
  identityPub: string;
  signedPrekeyPub: string;
  oneTimePrekeyPub?: string;
}

const CACHE_TTL_MS = 60_000;

export class DirectoryClient {
  private cache: Map<string, { data: BotProfile[]; ts: number }> = new Map();

  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  private cacheKey(opts: { capability?: string; topic?: string; q?: string }): string {
    return JSON.stringify(opts);
  }

  async register(body: RegisterBody, orgSig: string): Promise<{ ok: boolean }> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/bots/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-sig": orgSig,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`directory register failed: ${res.status} ${text}`);
    }
    return (await res.json()) as { ok: boolean };
  }

  async getBot(botId: string): Promise<BotProfile | null> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/bots/${encodeURIComponent(botId)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`directory getBot failed: ${res.status} ${text}`);
    }
    return (await res.json()) as BotProfile;
  }

  async listBots(capability?: string): Promise<BotProfile[]> {
    const url = capability
      ? `${this.baseUrl}/v1/bots?capability=${encodeURIComponent(capability)}`
      : `${this.baseUrl}/v1/bots`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`directory listBots failed: ${res.status} ${text}`);
    }
    return (await res.json()) as BotProfile[];
  }

  async search(q: string, limit = 20): Promise<BotProfile[]> {
    const res = await this.fetchFn(
      `${this.baseUrl}/v1/bots/search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`directory search failed: ${res.status} ${text}`);
    }
    return (await res.json()) as BotProfile[];
  }

  async find(opts: {
    capability?: string;
    topic?: string;
    q?: string;
    limit?: number;
  }): Promise<BotProfile[]> {
    const key = this.cacheKey(opts);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
    let results: BotProfile[];
    if (opts.q) {
      results = await this.search(opts.q, opts.limit ?? 20);
    } else if (opts.capability) {
      results = await this.listBots(opts.capability);
    } else if (opts.topic) {
      results = await this.search(opts.topic, opts.limit ?? 20);
    } else {
      results = await this.listBots();
    }
    if (opts.limit != null && results.length > opts.limit) {
      results = results.slice(0, opts.limit);
    }
    this.cache.set(key, { data: results, ts: Date.now() });
    return results;
  }

  async getPrekeyBundle(botId: string): Promise<PrekeyBundle> {
    const res = await this.fetchFn(
      `${this.baseUrl}/v1/bots/${encodeURIComponent(botId)}/prekey-bundle`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`directory prekey-bundle failed: ${res.status} ${text}`);
    }
    return (await res.json()) as PrekeyBundle;
  }

  async heartbeat(botId: string, orgSig: string): Promise<{ ok: boolean }> {
    const res = await this.fetchFn(
      `${this.baseUrl}/v1/bots/${encodeURIComponent(botId)}/heartbeat`,
      {
        method: "POST",
        headers: { "x-org-sig": orgSig },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`directory heartbeat failed: ${res.status} ${text}`);
    }
    return (await res.json()) as { ok: boolean };
  }
}

export interface RegisterBody {
  botId: string;
  displayName: string;
  capabilities: string[];
  topics: string[];
  reachability: Reachability;
  keys: BotKeys;
  meta?: Record<string, unknown>;
}
