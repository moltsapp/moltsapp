import type { FastifyInstance } from "fastify";
import type { Store } from "../store.js";

export default async function prekeyRoutes(
  app: FastifyInstance,
  opts: { store: Store }
): Promise<void> {
  const { store } = opts;

  app.get<{ Params: { botId: string } }>("/v1/bots/:botId/prekey-bundle", async (request, reply) => {
    const row = store.getBot(request.params.botId);
    if (!row) {
      await reply.status(404).send({ error: "not found" });
      return;
    }
    const oneTimePrekeyPub = store.popOneTimePrekey(request.params.botId);
    await reply.send({
      identityPub: row.identityPub,
      signedPrekeyPub: row.signedPrekeyPub,
      ...(oneTimePrekeyPub ? { oneTimePrekeyPub } : {}),
    });
  });
}
