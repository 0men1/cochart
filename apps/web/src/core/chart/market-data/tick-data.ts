import { ExchangeAdapter } from "@/core/chart/market-data/ExchangeAdapter";
import { ConnectionState, ExchangeType, TickData } from "@/core/chart/market-data/types";

// CACHE
const adaptersCache: Map<ExchangeType, ExchangeAdapter> = new Map();
const statusListeners: Map<ExchangeType, Set<(state: ConnectionState) => void>> = new Map();

// REGISTRY
const exchangeRegistry: Partial<Record<ExchangeType, () => Promise<ExchangeAdapter>>> = {
    "coinbase": async () => {
        const mod = await import("@/core/chart/market-data/exchanges/CoinbaseExchange")
        return new mod.CoinbaseExchange();
    },

    // "kraken": async () => {
    //     const mod = await import("@/core/chart/market-data/exchanges/CoinbaseExchange")
    //     return new mod.CoinbaseExchange();
    // },
};

async function loadAndCacheAdapter(exchange: ExchangeType): Promise<ExchangeAdapter | null> {
    if (!exchangeRegistry[exchange]) {
        console.error("(DNE) failed to load exchange")
        return null;
    }

    const cached = adaptersCache.get(exchange);
    if (cached) {
        return cached;
    }

    const exchangeAdapter = exchangeRegistry[exchange]()
        .then(obj => {
            obj.connect();
            adaptersCache.set(exchange, obj);
            const listeners = new Set<(state: ConnectionState) => void>();
            statusListeners.set(exchange, listeners);
            obj.onStatusChange((state: ConnectionState) => {
                listeners.forEach(l => l(state));
            })
            return obj;
        })
        .catch(error => {
            console.error("failed to load exchange: ", error)
            return null;
        })

    return exchangeAdapter!;
}

export async function subscribeToTicks(
    symbol: string,
    exchange: ExchangeType,
    onTick: (t: TickData) => void
): Promise<() => void> {
    const exchangeAdapter = await loadAndCacheAdapter(exchange);
    if (!exchangeAdapter) {
        throw new Error("failed to subscribe to tick data")
    }

    return exchangeAdapter.subscribe(symbol, onTick);
}

export async function subscribeToStatus(
    exchange: ExchangeType,
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
