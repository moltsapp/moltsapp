import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Store } from "../store.js";

export default async function heartbeatRoutes(
  app: FastifyInstance,
  opts: { store: Store; verifyOrgSig: (req: FastifyRequest, reply: FastifyReply) => Promise<void> }
): Promise<void> {
  const { store, verifyOrgSig } = opts;

  app.post<{ Params: { botId: string } }>(
    "/v1/bots/:botId/heartbeat",
    {
      preHandler: verifyOrgSig,
    },
    async (request, reply) => {
      const botId = request.params.botId;
      if (!store.getBot(botId)) {
        await reply.status(404).send({ error: "not found" });
        return;
      }
      store.updateLastSeen(botId);
      await reply.send({ ok: true });
    }
  );
}
