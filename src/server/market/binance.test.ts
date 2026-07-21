import { describe, it, expect } from "vitest";
import { binanceInterval, parseBinanceKlines } from "./binance";

describe("binanceInterval", () => {
  it("maps supported granularities to Binance interval strings, including 6H", () => {
    expect(binanceInterval(60)).toBe("1m");
    expect(binanceInterval(300)).toBe("5m");
    expect(binanceInterval(900)).toBe("15m");
    expect(binanceInterval(3600)).toBe("1h");
    expect(binanceInterval(21600)).toBe("6h");
    expect(binanceInterval(86400)).toBe("1d");
  });

  it("returns null for unsupported granularities", () => {
    expect(binanceInterval(120)).toBeNull();
  });
});

describe("parseBinanceKlines", () => {
  it("parses rows, converting ms open time to seconds", () => {
    // [openTime(ms), open, high, low, close, volume, closeTime, ...]
    const candles = parseBinanceKlines([
      [1700000000000, "1", "3", "0.5", "2", "10", 1700000059999],
      [1700000060000, "2", "4", "1.5", "3", "20", 1700000119999],
    ]);
    expect(candles).toEqual([
      { time: 1700000000, open: 1, high: 3, low: 0.5, close: 2, volume: 10 },
      { time: 1700000060, open: 2, high: 4, low: 1.5, close: 3, volume: 20 },
    ]);
  });

  it("skips malformed short rows", () => {
    expect(parseBinanceKlines([[1700000000000, "1", "3"]])).toEqual([]);
  });
});
