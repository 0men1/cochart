import { RoomManager } from "./collab/roomManager";
import { CoinbaseProvider } from "./market/coinbase";
import { SearchEngine } from "./market/search";
import { MarketService } from "./market/service";
import type { ExchangeProvider } from "./market/types";

// A single in-memory backend graph shared by every request in this process.
// Keeping these as module singletons is what guarantees the WS hub and the
// HTTP handlers see the same rooms / cache / search index.

const providers = new Map<string, ExchangeProvider>([
	["coinbase", new CoinbaseProvider()],
]);

export const marketService = new MarketService(providers);
export const searchEngine = new SearchEngine();
export const roomManager = new RoomManager();

let indexReady: Promise<void> | null = null;

// Build the search index once (lazily). Safe to call repeatedly.
export function ensureSearchIndex(): Promise<void> {
	if (!indexReady) {
		indexReady = searchEngine.buildIndex(providers).catch((err) => {
			console.error("Failed to build search index:", err);
			// Reset so a later request can retry.
			indexReady = null;
		});
	}
	return indexReady;
}
