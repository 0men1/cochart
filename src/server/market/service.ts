import { CandleCache } from "./cache";
import type { Candlestick, ExchangeProvider } from "./types";

const MAX_CANDLES_PER_REQUEST = 300;
const MAX_CONCURRENT_REQUESTS = 10;
const REQUEST_TIMEOUT_MS = 30_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(new Error("aborted"));
			},
			{ once: true },
		);
	});
}

export class MarketService {
	private cache = new CandleCache();

	constructor(private providers: Map<string, ExchangeProvider>) {}

	getProviders(): Map<string, ExchangeProvider> {
		return this.providers;
	}

	async fetchCandles(
		exchangeName: string,
		symbol: string,
		start: number,
		end: number,
		granularity: number,
	): Promise<Candlestick[]> {
		const provider = this.providers.get(exchangeName);
		if (!provider) {
			throw new Error(`exchange ${exchangeName} not found`);
		}

		const blockDuration = granularity * MAX_CANDLES_PER_REQUEST;
		const alignedStart = Math.floor(start / blockDuration) * blockDuration;

		const batchStarts: number[] = [];
		for (let t = alignedStart; t < end; t += blockDuration) {
			batchStarts.push(t);
		}

		// One 30s deadline shared across all batches (mirrors the Go context timeout).
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		// Results kept per-index so the final order is deterministic.
		const results: Candlestick[][] = batchStarts.map(() => []);

		const fetchBatch = async (idx: number, bStart: number): Promise<void> => {
			const gridEnd = bStart + blockDuration;
			const reqEnd = Math.min(gridEnd, end);
			const isPartialBlock = reqEnd < gridEnd;

			if (!isPartialBlock) {
				const cached = this.cache.get(symbol, exchangeName, bStart, granularity);
				if (cached.length > 0) {
					results[idx] = cached;
					return;
				}
			}

			let candles: Candlestick[] = [];
			let lastErr: unknown = null;

			for (let attempt = 0; attempt < 3; attempt++) {
				try {
					candles = await provider.fetchCandles(
						symbol,
						bStart,
						reqEnd,
						granularity,
						controller.signal,
					);
					lastErr = null;
					break;
				} catch (err) {
					lastErr = err;
					const backoff = 200 * (1 << attempt);
					const jitter = Math.floor(Math.random() * 50);
					await sleep(backoff + jitter, controller.signal);
				}
			}

			if (lastErr) throw lastErr;

			if (!isPartialBlock && candles.length > 0) {
				this.cache.save(symbol, exchangeName, bStart, granularity, candles);
			}

			results[idx] = candles;
		};

		try {
			await runWithConcurrency(
				batchStarts.map((bStart, idx) => () => fetchBatch(idx, bStart)),
				MAX_CONCURRENT_REQUESTS,
			);
		} finally {
			clearTimeout(timeout);
		}

		const merged = results.flat();
		merged.sort((a, b) => a.time - b.time);

		return merged.filter((c) => c.time >= start && c.time <= end);
	}
}

// Runs the given task factories with a bounded number in flight. Rejects on the
// first task error (matching the Go version, which fails the whole request).
async function runWithConcurrency(
	tasks: Array<() => Promise<void>>,
	limit: number,
): Promise<void> {
	let next = 0;
	const workers: Promise<void>[] = [];

	const worker = async (): Promise<void> => {
		while (next < tasks.length) {
			const idx = next++;
			await tasks[idx]();
		}
	};

	for (let i = 0; i < Math.min(limit, tasks.length); i++) {
		workers.push(worker());
	}

	await Promise.all(workers);
}
