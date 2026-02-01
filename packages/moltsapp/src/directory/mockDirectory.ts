/**
 * In-memory directory for demos/tests: register, getBot, getPrekeyBundle, find.
 */
import type { BotProfile, PrekeyBundle, RegisterBody } from "./client.js";

export class MockDirectoryClient {
  private bots = new Map<string, BotProfile>();
  private opks = new Map<string, string[]>();

  async register(body: RegisterBody, _orgSig: string): Promise<{ ok: boolean }> {
    const opks = (body.keys.oneTimePrekeysPub ?? []).slice(0, 50);
    this.opks.set(body.botId, opks);
    this.bots.set(body.botId, {
      botId: body.botId,
      displayName: body.displayName,
      capabilities: body.capabilities,
      topics: body.topics,
      reachability: body.reachability,
      keys: {
        identityPub: body.keys.identityPub,
        signedPrekeyPub: body.keys.signedPrekeyPub,
        signedPrekeySig: body.keys.signedPrekeySig,
        oneTimePrekeysPub: opks,
      },
      meta: body.meta,
    });
    return { ok: true };
  }

  async getBot(botId: string): Promise<BotProfile | null> {
    return this.bots.get(botId) ?? null;
  }

  async listBots(_capability?: string): Promise<BotProfile[]> {
    return Array.from(this.bots.values());
  }

  async search(_q: string, limit = 20): Promise<BotProfile[]> {
    return Array.from(this.bots.values()).slice(0, limit);
  }

  async find(opts: { capability?: string; topic?: string; q?: string; limit?: number }): Promise<BotProfile[]> {
    let list = Array.from(this.bots.values());
    if (opts.capability) {
      list = list.filter((b) => b.capabilities.includes(opts.capability!));
    }
    if (opts.limit != null) list = list.slice(0, opts.limit);
    return list;
  }

  async getPrekeyBundle(botId: string): Promise<PrekeyBundle> {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error("bot not found: " + botId);
    const opkList = this.opks.get(botId) ?? [];
    const oneTimePrekeyPub = opkList.length > 0 ? opkList.shift() : undefined;
    if (opkList.length >= 0) this.opks.set(botId, opkList);
    return {
      identityPub: bot.keys.identityPub,
      signedPrekeyPub: bot.keys.signedPrekeyPub,
      ...(oneTimePrekeyPub ? { oneTimePrekeyPub } : {}),
    };
  }
}
