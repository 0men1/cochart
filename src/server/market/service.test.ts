import { describe, it, expect } from "vitest";
import { MarketService } from "./service";
import type { Candlestick, ExchangeProvider, Product } from "./types";

type FetchImpl = (
  symbol: string,
  start: number,
  end: number,
  granularity: number,
) => Candlestick[];

function candle(time: number): Candlestick {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

// Mock provider that records its fetchCandles (start,end) calls.
function mockProvider(fetchImpl: FetchImpl) {
  const calls: Array<[number, number]> = [];
  const provider: ExchangeProvider = {
    id: () => "coinbase",
    getProducts: async (): Promise<Product[]> => [],
    fetchCandles: async (symbol, start, end, granularity) => {
      calls.push([start, end]);
      return fetchImpl(symbol, start, end, granularity);
    },
  };
  return { provider, calls };
}

function service(provider: ExchangeProvider): MarketService {
  return new MarketService(new Map([["coinbase", provider]]));
}

// granularity 60 -> blockDuration = 60 * 300 = 18000
const G = 60;
const BLOCK = 18000;

describe("MarketService batching", () => {
  it("splits the range into block-aligned batches", async () => {
    const { provider, calls } = mockProvider((_s, start) => [candle(start)]);
    await service(provider).fetchCandles("coinbase", "BTC-USD", 0, 2 * BLOCK, G);
    expect(calls).toEqual([
      [0, BLOCK],
      [BLOCK, 2 * BLOCK],
    ]);
  });

  it("aligns the first batch down to the block grid", async () => {
    const { provider, calls } = mockProvider((_s, start) => [candle(start)]);
    // start mid-block -> alignedStart floors to 0
    await service(provider).fetchCandles("coinbase", "BTC-USD", 6000, BLOCK, G);
    expect(calls[0][0]).toBe(0);
  });
});

describe("MarketService merge/sort/filter", () => {
  it("flattens, sorts by time, and returns candles in ascending order", async () => {
    const { provider } = mockProvider((_s, start) => [
      candle(start + G), // out of order within the block
      candle(start),
    ]);
    const out = await service(provider).fetchCandles(
      "coinbase",
      "BTC-USD",
      0,
      2 * BLOCK,
      G,
    );
    const times = out.map((c) => c.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(0);
  });

  it("filters out candles outside [start, end]", async () => {
    const { provider } = mockProvider((_s, start) => [
      candle(start),
      candle(999_999), // beyond end
    ]);
    const out = await service(provider).fetchCandles("coinbase", "BTC-USD", 0, BLOCK, G);
    expect(out.every((c) => c.time >= 0 && c.time <= BLOCK)).toBe(true);
    expect(out.some((c) => c.time === 999_999)).toBe(false);
  });
});

describe("MarketService caching", () => {
  it("serves full blocks from cache on a repeat call", async () => {
    const { provider, calls } = mockProvider((_s, start) => [candle(start)]);
    const svc = service(provider);
    await svc.fetchCandles("coinbase", "BTC-USD", 0, 2 * BLOCK, G);
    expect(calls.length).toBe(2);
    // Identical second call: both full blocks are cached, provider not hit again.
    await svc.fetchCandles("coinbase", "BTC-USD", 0, 2 * BLOCK, G);
    expect(calls.length).toBe(2);
  });
});

describe("MarketService coalescing", () => {
  it("collapses concurrent identical block fetches into one upstream call", async () => {
    // Provider whose fetch is held open until we release it, so both callers
    // are in flight for the same block at the same time.
    let release!: (c: Candlestick[]) => void;
    const gate = new Promise<Candlestick[]>((r) => {
      release = r;
    });
    const calls: Array<[number, number]> = [];
    const provider: ExchangeProvider = {
      id: () => "coinbase",
      getProducts: async (): Promise<Product[]> => [],
      fetchCandles: async (_s, start, end) => {
        calls.push([start, end]);
        return gate;
      },
    };
    const svc = service(provider);

    const p1 = svc.fetchCandles("coinbase", "BTC-USD", 0, BLOCK, G);
    const p2 = svc.fetchCandles("coinbase", "BTC-USD", 0, BLOCK, G);

    // Both requests have reached the in-flight check; only one hit the provider.
    expect(calls.length).toBe(1);

    release([candle(0)]);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(calls.length).toBe(1);
    expect(r1).toEqual([candle(0)]);
    expect(r2).toEqual(r1);
  });
});

describe("MarketService errors", () => {
  it("throws for an unknown exchange", async () => {
    const { provider } = mockProvider(() => []);
    await expect(
      service(provider).fetchCandles("nope", "BTC-USD", 0, BLOCK, G),
    ).rejects.toThrow(/not found/);
  });
});
