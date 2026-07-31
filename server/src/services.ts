import { RoomManager } from "./collab/roomManager";
import { SqliteRoomStore } from "./collab/roomStore";
import { logger } from "@cochart/protocol";
import { createRateLimiter } from "./feedback/rateLimit";
import { CoinbaseProvider } from "./market/coinbase";
import { KrakenProvider } from "./market/kraken";
import { BinanceProvider } from "./market/binance";
import { SearchEngine } from "./market/search";
import { MarketService } from "./market/service";
import type { ExchangeProvider } from "./market/types";

// A single in-memory backend graph shared by every request in this process.
// Keeping these as module singletons is what guarantees the WS hub and the
// HTTP handlers see the same rooms / cache / search index.
const providers = new Map<string, ExchangeProvider>([
  ["coinbase", new CoinbaseProvider()],
  ["kraken", new KrakenProvider()],
  ["binance", new BinanceProvider()],
]);

export const marketService = new MarketService(providers);
export const searchEngine = new SearchEngine();

// Rooms are persisted to SQLite so they survive a server restart. server.ts
// restores them on boot and flushes on shutdown / on an interval.
export const roomStore = new SqliteRoomStore(
  process.env.ROOM_DB_PATH ?? "./data/rooms.db",
);
export const roomManager = new RoomManager(roomStore);

export const candlesLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
export const searchLimiter = createRateLimiter({ limit: 300, windowMs: 60_000 });
export const createRoomLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

let indexReady: Promise<void> | null = null;

export function ensureSearchIndex(): Promise<void> {
  if (!indexReady) {
    indexReady = searchEngine.buildIndex(providers).catch((err) => {
      logger.error("Failed to build search index:", err);
      indexReady = null;
    });
  }
  return indexReady;
}
