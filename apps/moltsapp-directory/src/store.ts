/**
 * Store interface so we can use either better-sqlite3 or JSON file backend.
 */
export interface BotRow {
  botId: string;
  displayName: string;
  capabilities: string;
  topics: string;
  reachability: string;
  identityPub: string;
  signedPrekeyPub: string;
  opks: string;
  meta: string;
  lastSeen: number | null;
}

export interface Store {
  getBot(botId: string): BotRow | undefined;
  listBotsByCapability(capability: string): BotRow[];
  searchBots(q: string, limit: number): BotRow[];
  listAllBots(): BotRow[];
  upsertBot(row: Omit<BotRow, "lastSeen"> & { lastSeen?: number | null }): void;
  popOneTimePrekey(botId: string): string | null;
  updateLastSeen(botId: string): void;
}
