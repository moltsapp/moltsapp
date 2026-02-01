/**
 * Directory: register + search + prekey pop (using MockDirectoryClient)
 */
import { describe, it, expect } from "vitest";
import { MockDirectoryClient } from "./mockDirectory.js";

describe("directory", () => {
  it("register and getBot", async () => {
    const dir = new MockDirectoryClient();
    await dir.register(
      {
        botId: "bot:test-1",
        displayName: "Test Bot",
        capabilities: ["price_oracle"],
        topics: ["sol"],
        reachability: { transport: "openclaw", sessionKeyHint: "moltmesh:bot:test-1" },
        keys: {
          identityPub: "dGVzdC1wdWI=",
          signedPrekeyPub: "dGVzdC1zcGs=",
          oneTimePrekeysPub: ["b3BrMQ==", "b3BrMg=="],
        },
        meta: { env: "test" },
      },
      "fake-sig"
    );
    const bot = await dir.getBot("bot:test-1");
    expect(bot).not.toBeNull();
    expect(bot!.botId).toBe("bot:test-1");
    expect(bot!.keys.oneTimePrekeysPub).toHaveLength(2);
  });

  it("getPrekeyBundle pops one OPK", async () => {
    const dir = new MockDirectoryClient();
    await dir.register(
      {
        botId: "bot:opk-test",
        displayName: "OPK Bot",
        capabilities: [],
        topics: [],
        reachability: { transport: "openclaw" },
        keys: {
          identityPub: "aWRlbnRpdHk=",
          signedPrekeyPub: "c2lnbmVk",
          oneTimePrekeysPub: ["b25l", "dHdv", "dGhyZWU"],
        },
      },
      ""
    );
    const bundle1 = await dir.getPrekeyBundle("bot:opk-test");
    expect(bundle1.oneTimePrekeyPub).toBe("b25l");
    const bundle2 = await dir.getPrekeyBundle("bot:opk-test");
    expect(bundle2.oneTimePrekeyPub).toBe("dHdv");
    const bundle3 = await dir.getPrekeyBundle("bot:opk-test");
    expect(bundle3.oneTimePrekeyPub).toBe("dGhyZWU");
    const bundle4 = await dir.getPrekeyBundle("bot:opk-test");
    expect(bundle4.oneTimePrekeyPub).toBeUndefined();
  });

  it("find returns bots by capability", async () => {
    const dir = new MockDirectoryClient();
    await dir.register(
      {
        botId: "bot:a",
        displayName: "A",
        capabilities: ["price_oracle"],
        topics: [],
        reachability: { transport: "openclaw" },
        keys: { identityPub: "YQ==", signedPrekeyPub: "YQ==" },
      },
      ""
    );
    await dir.register(
      {
        botId: "bot:b",
        displayName: "B",
        capabilities: ["price_oracle", "movers"],
        topics: [],
        reachability: { transport: "openclaw" },
        keys: { identityPub: "Yg==", signedPrekeyPub: "Yg==" },
      },
      ""
    );
    const list = await dir.find({ capability: "price_oracle" });
    expect(list.length).toBe(2);
    const movers = await dir.find({ capability: "movers" });
    expect(movers.length).toBe(1);
    expect(movers[0].botId).toBe("bot:b");
  });
});
