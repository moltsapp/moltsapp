import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Store } from "../store.js";

interface RegisterBody {
  botId: string;
  displayName: string;
  capabilities: string[];
  topics: string[];
  reachability: { transport: string; sessionKeyHint?: string };
  keys: {
    identityPub: string;
    signedPrekeyPub: string;
    signedPrekeySig?: string;
    oneTimePrekeysPub?: string[];
  };
  meta?: Record<string, unknown>;
}

export default async function registerRoutes(
  app: FastifyInstance,
  opts: { store: Store; verifyOrgSig: (req: FastifyRequest, reply: FastifyReply) => Promise<void> }
): Promise<void> {
  const { store, verifyOrgSig } = opts;

  app.post<{ Body: RegisterBody }>(
    "/v1/bots/register",
    {
      preHandler: verifyOrgSig,
    },
    async (request, reply) => {
      const body = request.body;
      if (
        !body.botId ||
        !body.displayName ||
        !Array.isArray(body.capabilities) ||
        !Array.isArray(body.topics) ||
        !body.reachability ||
        !body.keys?.identityPub ||
        !body.keys?.signedPrekeyPub
      ) {
        await reply.status(400).send({ error: "missing required fields" });
        return;
      }
      const opks = (body.keys.oneTimePrekeysPub ?? []).slice(0, 50);
      store.upsertBot({
        botId: body.botId,
        displayName: body.displayName,
        capabilities: JSON.stringify(body.capabilities),
        topics: JSON.stringify(body.topics),
        reachability: JSON.stringify(body.reachability),
        identityPub: body.keys.identityPub,
        signedPrekeyPub: body.keys.signedPrekeyPub,
        opks: JSON.stringify(opks),
        meta: body.meta ? JSON.stringify(body.meta) : "",
      });
      await reply.send({ ok: true });
    }
  );
}
