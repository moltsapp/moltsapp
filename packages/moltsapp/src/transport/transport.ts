/**
 * Transport abstraction: send/receive session messages and resolve session key for a bot.
 */
export interface Transport {
  send(toSessionKey: string, payload: unknown): Promise<void>;
  onMessage(handler: (fromSessionKey: string, payload: unknown) => void): void;
  resolveSessionKeyForBot(botId: string, hint?: string): Promise<string>;
}
