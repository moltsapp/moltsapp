/**
 * Demo: two in-process bots using MockTransport and MockDirectoryClient.
 * Run: npx tsx demo/ping.ts (from packages/moltsapp)
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import sodium from "libsodium-wrappers";
import { Moltsapp } from "../src/runtime/moltsapp.js";
import { MockTransport } from "../src/transport/mockTransport.js";
import { MockDirectoryClient } from "../src/directory/mockDirectory.js";

async function main(): Promise<void> {
  await sodium.ready;

  const tmpDir = join(process.cwd(), ".moltsapp-demo");
  rmSync(tmpDir, { recursive: true, force: true });
  const dirA = join(tmpDir, "botA");
  const dirB = join(tmpDir, "botB");
  mkdirSync(join(dirA, ".moltsapp"), { recursive: true });
  mkdirSync(join(dirB, ".moltsapp"), { recursive: true });

  const keyPairA = sodium.crypto_kx_keypair();
  const keyPairB = sodium.crypto_kx_keypair();
  const botIdA = "bot:demo-a";
  const botIdB = "bot:demo-b";
  const sessionKeyA = `moltmesh:${botIdA}`;
  const sessionKeyB = `moltmesh:${botIdB}`;

  writeFileSync(
    join(dirA, ".moltsapp", "identity.json"),
    JSON.stringify(
      {
        botId: botIdA,
        publicKey: sodium.to_base64(keyPairA.publicKey),
        secretKey: sodium.to_base64(keyPairA.privateKey),
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    join(dirB, ".moltsapp", "identity.json"),
    JSON.stringify(
      {
        botId: botIdB,
        publicKey: sodium.to_base64(keyPairB.publicKey),
        secretKey: sodium.to_base64(keyPairB.privateKey),
      },
      null,
      2
    ),
    "utf8"
  );

  const mockDir = new MockDirectoryClient();
  await mockDir.register(
    {
      botId: botIdA,
      displayName: "Demo Bot A",
      capabilities: ["demo"],
      topics: ["ping"],
      reachability: { transport: "openclaw", sessionKeyHint: sessionKeyA },
      keys: {
        identityPub: sodium.to_base64(keyPairA.publicKey),
        signedPrekeyPub: sodium.to_base64(keyPairA.publicKey),
        oneTimePrekeysPub: [],
      },
      meta: { env: "demo", version: "1.0.0" },
    },
    ""
  );
  await mockDir.register(
    {
      botId: botIdB,
      displayName: "Demo Bot B",
      capabilities: ["demo"],
      topics: ["ping"],
      reachability: { transport: "openclaw", sessionKeyHint: sessionKeyB },
      keys: {
        identityPub: sodium.to_base64(keyPairB.publicKey),
        signedPrekeyPub: sodium.to_base64(keyPairB.publicKey),
        oneTimePrekeysPub: [],
      },
      meta: { env: "demo", version: "1.0.0" },
    },
    ""
  );

  const mockTransport = new MockTransport();
  const transportA = mockTransport.withSender(sessionKeyA);
  const transportB = mockTransport.withSender(sessionKeyB);

  const moltsappA = new Moltsapp({
    workspaceDir: dirA,
    directoryUrl: "http://localhost:7777",
    transport: transportA,
    directoryClient: mockDir as unknown as import("../src/directory/client.js").DirectoryClient,
  });
  const moltsappB = new Moltsapp({
    workspaceDir: dirB,
    directoryUrl: "http://localhost:7777",
    transport: transportB,
    directoryClient: mockDir as unknown as import("../src/directory/client.js").DirectoryClient,
  });

  moltsappB.onMessage(({ subtype, plaintext }) => {
    if (subtype === "query" && plaintext.subtype === "query") {
      const { queryId } = plaintext.body;
      moltsappB
        .answer(queryId, {
          payload: { pong: true, from: botIdB },
          confidence: 1,
        })
        .catch(console.error);
    }
  });

  const bots = await moltsappA.find({ capability: "demo" });
  console.log("Found bots:", bots.map((b) => b.botId));
  const queryId = await moltsappA.query(botIdB, { topic: "ping", payload: {} });
  const answer = await moltsappA.awaitQueryAnswer(queryId, 5000);
  console.log("Query answer:", answer);
  console.log("Demo done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
