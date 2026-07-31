import { describe, it, expect, vi, afterEach } from "vitest";
import { CandleCache } from "./cache";
import type { Candlestick } from "./types";

const candles: Candlestick[] = [{ time: 100, open: 1, high: 1, low: 1, close: 1 }];

afterEach(() => {
  vi.useRealTimers();
});

describe("CandleCache", () => {
  it("returns an empty array on a miss", () => {
    const cache = new CandleCache();
    expect(cache.get("BTC-USD", "coinbase", 0, 60)).toEqual([]);
  });

  it("returns saved candles on a hit", () => {
    const cache = new CandleCache();
    cache.save("BTC-USD", "coinbase", 0, 60, candles);
    expect(cache.get("BTC-USD", "coinbase", 0, 60)).toEqual(candles);
  });

  it("isolates entries by symbol, exchange, granularity, and start", () => {
    const cache = new CandleCache();
    cache.save("BTC-USD", "coinbase", 0, 60, candles);
    expect(cache.get("ETH-USD", "coinbase", 0, 60)).toEqual([]); // different symbol
    expect(cache.get("BTC-USD", "kraken", 0, 60)).toEqual([]); // different exchange
    expect(cache.get("BTC-USD", "coinbase", 0, 300)).toEqual([]); // different granularity
    expect(cache.get("BTC-USD", "coinbase", 18000, 60)).toEqual([]); // different start
  });

  it("prunes entries older than the TTL", () => {
    vi.useFakeTimers();
    const ttl = 1000;
    const cache = new CandleCache(ttl);
    cache.save("BTC-USD", "coinbase", 0, 60, candles);
    expect(cache.get("BTC-USD", "coinbase", 0, 60)).toEqual(candles);

    // Advance past the TTL so the prune interval fires and drops the entry.
    vi.advanceTimersByTime(ttl * 2);
    expect(cache.get("BTC-USD", "coinbase", 0, 60)).toEqual([]);
  });
});
