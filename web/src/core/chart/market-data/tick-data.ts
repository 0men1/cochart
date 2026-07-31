import { ExchangeAdapter } from "@/core/chart/market-data/ExchangeAdapter";
import { logger } from "@/lib/logger";
import { ConnectionState, TickData } from "@/core/chart/market-data/types";

// CACHE
// Keyed by exchange. We cache the in-flight *promise* (not just the resolved
// adapter) so concurrent callers before the first connect resolves all share
// one adapter/socket instead of each creating and connecting their own.
const adaptersCache: Map<string, Promise<ExchangeAdapter>> = new Map();
const statusListeners: Map<string, Set<(state: ConnectionState) => void>> = new Map();

// REGISTRY
const exchangeRegistry: Partial<Record<string, () => Promise<ExchangeAdapter>>> = {
	"coinbase": async () => {
		const mod = await import("@/core/chart/market-data/exchanges/CoinbaseExchange")
		return new mod.CoinbaseExchange();
	},
	"kraken": async () => {
		const mod = await import("@/core/chart/market-data/exchanges/KrakenExchange")
		return new mod.KrakenExchange();
	},
	"binance": async () => {
		const mod = await import("@/core/chart/market-data/exchanges/BinanceExchange")
		return new mod.BinanceExchange();
	},
};

async function loadAndCacheAdapter(exchange: string): Promise<ExchangeAdapter | null> {
	const factory = exchangeRegistry[exchange];
	if (!factory) {
		logger.error("(DNE) failed to load exchange")
		return null;
	}

	const cached = adaptersCache.get(exchange);
	if (cached) {
		return cached;
	}

	const pending = factory().then(obj => {
		obj.connect();
		const listeners = new Set<(state: ConnectionState) => void>();
		statusListeners.set(exchange, listeners);
		obj.onStatusChange((state: ConnectionState) => {
			listeners.forEach(l => l(state));
		})
		return obj;
	})

	// Store the promise synchronously (before the first await returns) so a
	// second concurrent call reuses it instead of connecting a new adapter.
	adaptersCache.set(exchange, pending);

	try {
		return await pending;
	} catch (error) {
		// Drop the failed promise so a later call can retry from scratch.
		logger.error("failed to load exchange: ", error)
		adaptersCache.delete(exchange);
		return null;
	}
}

export async function subscribeToTicks(
	symbol: string,
	exchange: string,
	onTick: (t: TickData) => void
): Promise<() => void> {
	const exchangeAdapter = await loadAndCacheAdapter(exchange);
	if (!exchangeAdapter) {
		throw new Error("failed to subscribe to tick data")
	}

	return exchangeAdapter.subscribe(symbol, onTick);
}

export async function subscribeToStatus(
	exchange: string,
	onState: (state: ConnectionState) => void
) {
	await loadAndCacheAdapter(exchange);

	const listenerSet = statusListeners.get(exchange);
	if (listenerSet) {
		listenerSet.add(onState);
		return () => listenerSet.delete(onState);
	}
	return null;
}
