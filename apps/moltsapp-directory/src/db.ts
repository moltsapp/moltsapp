/**
 * SQLite storage for bots and prekeys (better-sqlite3). Throws if native bindings unavailable.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Store, BotRow } from "./store.js";

export function createDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      botId TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      topics TEXT NOT NULL,
      reachability TEXT NOT NULL,
      identityPub TEXT NOT NULL,
      signedPrekeyPub TEXT NOT NULL,
      opks TEXT NOT NULL,
      meta TEXT,
      lastSeen INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bots_capabilities ON bots(capabilities);
    CREATE INDEX IF NOT EXISTS idx_bots_lastSeen ON bots(lastSeen);
  `);
  return db;
}

export function createStore(dbPath: string): Store {
  const db = createDb(dbPath);
  return {
    getBot(botId: string) {
      return db.prepare("SELECT * FROM bots WHERE botId = ?").get(botId) as BotRow | undefined;
    },
    listBotsByCapability(capability: string) {
      return db
        .prepare(
          "SELECT bots.* FROM bots, json_each(json(bots.capabilities)) WHERE json_each.value = ?"
        )
        .all(capability) as BotRow[];
    },
    searchBots(q: string, limit: number) {
      const like = `%${q}%`;
      return db
        .prepare(
          `SELECT * FROM bots WHERE displayName LIKE ? OR capabilities LIKE ? OR topics LIKE ? LIMIT ?`
        )
        .all(like, like, like, limit) as BotRow[];
    },
    listAllBots() {
      return db.prepare("SELECT * FROM bots").all() as BotRow[];
    },
    upsertBot(row: Omit<BotRow, "lastSeen"> & { lastSeen?: number | null }) {
      db.prepare(
        `INSERT INTO bots (botId, displayName, capabilities, topics, reachability, identityPub, signedPrekeyPub, opks, meta, lastSeen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(botId) DO UPDATE SET
           displayName = excluded.displayName,
           capabilities = excluded.capabilities,
           topics = excluded.topics,
           reachability = excluded.reachability,
           identityPub = excluded.identityPub,
           signedPrekeyPub = excluded.signedPrekeyPub,
           opks = excluded.opks,
           meta = excluded.meta,
           lastSeen = COALESCE(excluded.lastSeen, lastSeen)`
      ).run(
        row.botId,
        row.displayName,
        row.capabilities,
        row.topics,
        row.reachability,
        row.identityPub,
        row.signedPrekeyPub,
        row.opks,
        row.meta ?? "",
        row.lastSeen ?? null
      );
    },
    popOneTimePrekey(botId: string) {
      const row = db.prepare("SELECT * FROM bots WHERE botId = ?").get(botId) as BotRow | undefined;
      if (!row) return null;
      const opks: string[] = JSON.parse(row.opks || "[]");
      if (opks.length === 0) return null;
      const popped = opks.shift()!;
      db.prepare("UPDATE bots SET opks = ? WHERE botId = ?").run(JSON.stringify(opks), botId);
      return popped;
    },
    updateLastSeen(botId: string) {
      db.prepare("UPDATE bots SET lastSeen = ? WHERE botId = ?").run(Date.now(), botId);
    },
  };
}
