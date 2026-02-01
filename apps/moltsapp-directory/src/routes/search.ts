import type { FastifyInstance } from "fastify";
import type { Store } from "../store.js";

function rowToProfile(row: { botId: string; displayName: string; capabilities: string; topics: string; reachability: string; identityPub: string; signedPrekeyPub: string; opks: string; meta: string | null; lastSeen: number | null }): Record<string, unknown> {
  const opksArr: string[] = JSON.parse(row.opks || "[]");
  return {
    botId: row.botId,
    displayName: row.displayName,
    capabilities: JSON.parse(row.capabilities || "[]"),
    topics: JSON.parse(row.topics || "[]"),
    reachability: JSON.parse(row.reachability || "{}"),
    keys: {
      identityPub: row.identityPub,
      signedPrekeyPub: row.signedPrekeyPub,
      oneTimePrekeysPub: opksArr,
    },
    meta: row.meta ? JSON.parse(row.meta) : undefined,
    lastSeen: row.lastSeen ?? undefined,
  };
}

export default async function searchRoutes(
  app: FastifyInstance,
  opts: { store: Store }
): Promise<void> {
  const { store } = opts;

  app.get<{ Params: { botId: string } }>("/v1/bots/:botId", async (request, reply) => {
    const row = store.getBot(request.params.botId);
    if (!row) {
      await reply.status(404).send({ error: "not found" });
      return;
    }
    await reply.send(rowToProfile(row));
  });

  app.get<{ Querystring: { capability?: string } }>("/v1/bots", async (request, reply) => {
    const capability = request.query.capability;
    const rows = capability
      ? store.listBotsByCapability(capability)
      : store.listAllBots();
    await reply.send(rows.map(rowToProfile));
  });

  app.get<{ Querystring: { q?: string; limit?: string } }>("/v1/bots/search", async (request, reply) => {
    const q = request.query.q ?? "";
    const limit = Math.min(100, parseInt(request.query.limit ?? "20", 10) || 20);
    const rows = store.searchBots(q, limit);
    await reply.send(rows.map(rowToProfile));
  });
}
