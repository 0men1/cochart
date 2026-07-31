import { describe, it, expect, vi } from "vitest";

// A fake exchange that counts constructions/connects so we can prove the cache
// coalesces concurrent loads into a single adapter/socket.
vi.mock("@/core/chart/market-data/exchanges/CoinbaseExchange", () => {
  class CoinbaseExchange {
    static constructed = 0;
    static connected = 0;
    constructor() {
      CoinbaseExchange.constructed++;
    }
    connect() {
      CoinbaseExchange.connected++;
    }
    subscribe() {
      return () => {};
    }
    onStatusChange() {}
  }
  return { CoinbaseExchange };
});

import { CoinbaseExchange } from "@/core/chart/market-data/exchanges/CoinbaseExchange";
import { subscribeToTicks } from "./tick-data";

describe("tick-data adapter cache", () => {
  it("creates a single adapter for concurrent subscribes to the same exchange", async () => {
    const [unsubA, unsubB] = await Promise.all([
      subscribeToTicks("BTC-USD", "coinbase", () => {}),
      subscribeToTicks("BTC-USD", "coinbase", () => {}),
    ]);

    // Before the fix, each concurrent call missed the not-yet-populated cache
    // and constructed + connected its own adapter.
    expect((CoinbaseExchange as unknown as { constructed: number }).constructed).toBe(1);
    expect((CoinbaseExchange as unknown as { connected: number }).connected).toBe(1);
    expect(typeof unsubA).toBe("function");
    expect(typeof unsubB).toBe("function");
  });
});
