/**
 * JSON file store for bots (no native deps). Use when better-sqlite3 isn't built.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Store, BotRow } from "./store.js";

interface JsonStore {
  bots: Record<string, BotRow>;
}

function load(filePath: string): JsonStore {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as JsonStore;
}

function save(filePath: string, data: JsonStore): void {
  writeFileSync(filePath, JSON.stringify(data), "utf8");
}

export function createJsonStore(filePath: string): Store {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify({ bots: {} }), "utf8");
  }
  return {
    getBot(botId: string) {
      return load(filePath).bots[botId];
    },
    listBotsByCapability(capability: string) {
      const data = load(filePath);
      return Object.values(data.bots).filter((b) => {
        const cap = JSON.parse(b.capabilities || "[]") as string[];
        return cap.includes(capability);
      });
    },
    searchBots(q: string, limit: number) {
      const data = load(filePath);
      const like = q.toLowerCase();
      return Object.values(data.bots)
        .filter(
          (b) =>
            (b.displayName && b.displayName.toLowerCase().includes(like)) ||
            (b.capabilities && b.capabilities.toLowerCase().includes(like)) ||
            (b.topics && b.topics.toLowerCase().includes(like))
        )
        .slice(0, limit);
    },
    listAllBots() {
      return Object.values(load(filePath).bots);
    },
    upsertBot(row: Omit<BotRow, "lastSeen"> & { lastSeen?: number | null }) {
      const data = load(filePath);
      const existing = data.bots[row.botId];
      data.bots[row.botId] = {
        ...row,
        lastSeen: row.lastSeen ?? existing?.lastSeen ?? null,
      };
      save(filePath, data);
    },
    popOneTimePrekey(botId: string) {
      const data = load(filePath);
      const row = data.bots[botId];
      if (!row) return null;
      const opks: string[] = JSON.parse(row.opks || "[]");
      if (opks.length === 0) return null;
      const popped = opks.shift()!;
      data.bots[botId] = { ...row, opks: JSON.stringify(opks) };
      save(filePath, data);
      return popped;
    },
    updateLastSeen(botId: string) {
      const data = load(filePath);
      const row = data.bots[botId];
      if (!row) return;
      data.bots[botId] = { ...row, lastSeen: Date.now() };
      save(filePath, data);
    },
  };
}
