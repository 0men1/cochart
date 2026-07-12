import type { Candlestick } from "./types";

interface CacheCandleBatch {
	data: Candlestick[];
	createdAt: number;
}

// Cache key: <symbol>-<exchange>-<granularity>-<startTime>
export class CandleCache {
	private cache = new Map<string, CacheCandleBatch>();

	constructor(ttlMs: number = 5 * 60 * 1000) {
		// Node's event loop is single-threaded, so no locking is needed
		// (unlike the Go version's RWMutex). Prune on an interval; unref so
		// the timer never keeps the process alive on its own.
		const timer = setInterval(() => this.prune(ttlMs), ttlMs);
		timer.unref?.();
	}

	private key(
		symbol: string,
		exchange: string,
		start: number,
		granularity: number,
	): string {
		return `${symbol}-${exchange}-${granularity}-${start}`;
	}

	get(
		symbol: string,
		exchange: string,
		start: number,
		granularity: number,
	): Candlestick[] {
		const batch = this.cache.get(this.key(symbol, exchange, start, granularity));
		return batch ? batch.data : [];
	}

	save(
		symbol: string,
		exchange: string,
		start: number,
		granularity: number,
		candles: Candlestick[],
	): void {
		this.cache.set(this.key(symbol, exchange, start, granularity), {
			data: candles,
			createdAt: Date.now(),
		});
	}

	private prune(ttlMs: number): void {
		const now = Date.now();
		for (const [k, v] of this.cache) {
			if (now - v.createdAt > ttlMs) {
				this.cache.delete(k);
			}
		}
	}
}
