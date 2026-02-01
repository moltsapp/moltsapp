/**
 * Verify x-org-sig: Ed25519 signature over request body bytes using ORG_PUBLIC_KEY.
 */
import nacl from "tweetnacl";
import type { FastifyRequest, FastifyReply } from "fastify";

const HEADER = "x-org-sig";

export function verifyOrgSig(orgPublicKeyBase64: string) {
  const publicKey = Buffer.from(orgPublicKeyBase64, "base64");
  if (publicKey.length !== nacl.sign.publicKeyLength) {
    throw new Error("orgSig: invalid ORG_PUBLIC_KEY length");
  }

  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const sigHeader = request.headers[HEADER];
    if (typeof sigHeader !== "string") {
      await reply.status(401).send({ error: "missing x-org-sig" });
      return;
    }
    const rawBody =
      typeof (request as FastifyRequest & { rawBody?: string }).rawBody === "string"
        ? (request as FastifyRequest & { rawBody: string }).rawBody
        : JSON.stringify((request as FastifyRequest<{ Body: unknown }>).body ?? "");
    const message = Buffer.from(rawBody, "utf8");
    const signature = Buffer.from(sigHeader, "base64");
    if (signature.length !== nacl.sign.signatureLength) {
      await reply.status(401).send({ error: "invalid signature length" });
      return;
    }
    const ok = nacl.sign.detached.verify(
      message,
      new Uint8Array(signature),
      new Uint8Array(publicKey)
    );
    if (!ok) {
      await reply.status(401).send({ error: "invalid org signature" });
      return;
    }
  };
}
