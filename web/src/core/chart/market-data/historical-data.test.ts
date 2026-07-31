import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchHistoricalCandles } from "./historical-data";

function mockFetch(res: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res as Response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchHistoricalCandles", () => {
  it("returns [] without parsing the body on a non-OK response", async () => {
    const json = vi.fn(); // must NOT be called
    mockFetch({ ok: false, status: 502, statusText: "Bad Gateway", json });
    const out = await fetchHistoricalCandles("BTC-USD", "coinbase", "1H", 0, 100);
    expect(out).toEqual([]);
    expect(json).not.toHaveBeenCalled();
  });

  it("returns [] when the OK body is not an array", async () => {
    mockFetch({ ok: true, json: async () => ({ error: "nope" }) });
    const out = await fetchHistoricalCandles("BTC-USD", "coinbase", "1H", 0, 100);
    expect(out).toEqual([]);
  });

  it("maps a well-formed candle array", async () => {
    mockFetch({
      ok: true,
      json: async () => [
        { time: 1, open: 1, high: 2, low: 0, close: 1.5, volume: 10 },
      ],
    });
    const out = await fetchHistoricalCandles("BTC-USD", "coinbase", "1H", 0, 100);
    expect(out).toEqual([
      { time: 1, open: 1, high: 2, low: 0, close: 1.5, volume: 10 },
    ]);
  });

  it("returns [] when start is after end (no fetch)", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const out = await fetchHistoricalCandles("BTC-USD", "coinbase", "1H", 100, 0);
    expect(out).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
