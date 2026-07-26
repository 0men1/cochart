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

// Mirrors CandleCache's key so in-flight coalescing and the cache line up.
function blockKey(
  symbol: string,
  exchange: string,
  start: number,
  granularity: number,
): string {
  return `${symbol}-${exchange}-${granularity}-${start}`;
}

export class MarketService {
  private cache = new CandleCache();
  // Single-flight: full blocks currently being fetched, keyed like the cache.
  // Concurrent identical block fetches share one upstream request.
  private inFlight = new Map<string, Promise<Candlestick[]>>();

  constructor(private providers: Map<string, ExchangeProvider>) { }

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

      // The trailing partial block is still "live" (its last bar keeps
      // changing), so it is neither cached nor coalesced.
      if (isPartialBlock) {
        results[idx] = await this.fetchWithRetry(
          provider,
          symbol,
          bStart,
          reqEnd,
          granularity,
          controller.signal,
        );
        return;
      }

      const cached = this.cache.get(symbol, exchangeName, bStart, granularity);
      if (cached.length > 0) {
        results[idx] = cached;
        return;
      }

      // Coalesce concurrent identical full-block fetches (e.g. several
      // clients opening the same symbol at once) into a single upstream
      // request. A late caller shares the initiator's request deadline.
      const key = blockKey(symbol, exchangeName, bStart, granularity);
      let pending = this.inFlight.get(key);
      if (!pending) {
        pending = this.fetchWithRetry(
          provider,
          symbol,
          bStart,
          reqEnd,
          granularity,
          controller.signal,
        ).then((candles) => {
          if (candles.length > 0) {
            this.cache.save(symbol, exchangeName, bStart, granularity, candles);
          }
          return candles;
        });
        this.inFlight.set(key, pending);
        // Clear the slot once settled (either outcome) so a later request
        // re-fetches rather than reusing a dead promise.
        const clear = () => this.inFlight.delete(key);
        pending.then(clear, clear);
      }

      results[idx] = await pending;
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

  // Fetches a single block with bounded retries (jittered exponential backoff),
  // matching the Go version, which fails the whole request on exhaustion.
  private async fetchWithRetry(
    provider: ExchangeProvider,
    symbol: string,
    start: number,
    end: number,
    granularity: number,
    signal: AbortSignal,
  ): Promise<Candlestick[]> {
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await provider.fetchCandles(
          symbol,
          start,
          end,
          granularity,
          signal,
        );
      } catch (err) {
        lastErr = err;
        const backoff = 200 * (1 << attempt);
        const jitter = Math.floor(Math.random() * 50);
        await sleep(backoff + jitter, signal);
      }
    }

    throw lastErr;
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
