/**
 * moltsapp-directory: Fastify HTTP service for discovery + prekeys.
 */
import "dotenv/config";
import { Readable } from "node:stream";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createStore } from "./db.js";
import { createJsonStore } from "./db-json.js";
import type { Store } from "./store.js";
import { verifyOrgSig } from "./middleware/orgSig.js";
import registerRoutes from "./routes/register.js";
import searchRoutes from "./routes/search.js";
import prekeyRoutes from "./routes/prekey.js";
import heartbeatRoutes from "./routes/heartbeat.js";

const ORG_PUBLIC_KEY = process.env.ORG_PUBLIC_KEY ?? "";
const PORT = parseInt(process.env.PORT ?? "7777", 10);
const DB_PATH = process.env.DB_PATH ?? "./moltsapp.sqlite";

async function main(): Promise<void> {
  if (!ORG_PUBLIC_KEY) {
    console.error("ORG_PUBLIC_KEY is required");
    process.exit(1);
  }

  let store: Store;
  try {
    store = createStore(DB_PATH);
  } catch (err) {
    console.warn("better-sqlite3 unavailable, using JSON file store:", (err as Error).message);
    store = createJsonStore(DB_PATH.replace(/\.sqlite$/, ".json"));
  }
  const verifyOrgSigMiddleware = verifyOrgSig(ORG_PUBLIC_KEY);

  const app = Fastify({ logger: true });

  app.addHook("preParsing", async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);
    (request as FastifyRequestWithRawBody).rawBody = buf.toString("utf8");
    return Readable.from(buf);
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    if (typeof body === "string" && !(req as FastifyRequestWithRawBody).rawBody) {
      (req as FastifyRequestWithRawBody).rawBody = body;
    }
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  await app.register(cors, { origin: true });

  await app.register(registerRoutes, { store, verifyOrgSig: verifyOrgSigMiddleware });
  await app.register(searchRoutes, { store });
  await app.register(prekeyRoutes, { store });
  await app.register(heartbeatRoutes, { store, verifyOrgSig: verifyOrgSigMiddleware });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`moltsapp-directory listening on port ${PORT}`);
}

interface FastifyRequestWithRawBody {
  rawBody?: string;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
