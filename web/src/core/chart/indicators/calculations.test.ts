import { describe, it, expect } from "vitest";
import type { UTCTimestamp } from "cochart-charts";
import { Candlestick } from "@/core/chart/market-data/types";
import { sma, ema, vwap, rsi, macd, volume, UP_COLOR, DOWN_COLOR } from "./calculations";

// Build candles from a list of closes; OHLC default to close and volume to 1
// unless overridden, which is all the moving-average style tests need.
function candlesFromCloses(closes: number[]): Candlestick[] {
  return closes.map((close, i) => ({
    time: (i * 60) as UTCTimestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
}

describe("sma", () => {
  it("averages over the trailing window and starts at bar period-1", () => {
    const result = sma(candlesFromCloses([1, 2, 3, 4, 5]), 3);
    expect(result.map((p) => p.value)).toEqual([2, 3, 4]);
    expect(result[0].time).toBe(120); // 3rd bar (index 2) at 60s spacing
  });

  it("returns empty when there are fewer bars than the period", () => {
    expect(sma(candlesFromCloses([1, 2]), 3)).toEqual([]);
  });

  it("returns empty for a non-positive period", () => {
    expect(sma(candlesFromCloses([1, 2, 3]), 0)).toEqual([]);
  });
});

describe("ema", () => {
  it("seeds with the SMA then applies the smoothing factor", () => {
    // period 3 => k = 0.5. Seed = mean(2,4,6) = 4 at index 2.
    // index 3: 8*0.5 + 4*0.5 = 6. index 4: 10*0.5 + 6*0.5 = 8.
    const result = ema(candlesFromCloses([2, 4, 6, 8, 10]), 3);
    expect(result.map((p) => p.value)).toEqual([4, 6, 8]);
  });

  it("returns empty when there are fewer bars than the period", () => {
    expect(ema(candlesFromCloses([1, 2]), 5)).toEqual([]);
  });
});

describe("vwap", () => {
  it("computes a running volume-weighted typical price", () => {
    const candles: Candlestick[] = [
      { time: 0 as UTCTimestamp, open: 0, high: 2, low: 1, close: 3, volume: 2 }, // typical 2
      { time: 60 as UTCTimestamp, open: 0, high: 6, low: 3, close: 6, volume: 4 }, // typical 5
    ];
    const result = vwap(candles);
    expect(result[0].value).toBe(2);
    // (2*2 + 5*4) / (2+4) = 24/6 = 4
    expect(result[1].value).toBe(4);
  });

  it("falls back to typical price when volume is zero", () => {
    const candles: Candlestick[] = [
      { time: 0 as UTCTimestamp, open: 0, high: 3, low: 3, close: 3, volume: 0 },
    ];
    expect(vwap(candles)[0].value).toBe(3);
  });
});

describe("rsi", () => {
  it("returns 100 when every change is a gain", () => {
    const result = rsi(candlesFromCloses([1, 2, 3, 4, 5]), 3);
    expect(result.length).toBe(2);
    expect(result.every((p) => p.value === 100)).toBe(true);
  });

  it("stays within 0..100 for mixed movement", () => {
    const result = rsi(candlesFromCloses([10, 11, 10, 12, 9, 13, 8]), 3);
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it("returns empty when there are not enough bars", () => {
    expect(rsi(candlesFromCloses([1, 2, 3]), 3)).toEqual([]);
  });
});

describe("macd", () => {
  it("produces aligned macd/signal/histogram series", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const result = macd(candlesFromCloses(closes), 12, 26, 9);
    expect(result.macdLine.length).toBeGreaterThan(0);
    // Signal (and thus histogram) starts `signal-1` bars after the macd line.
    expect(result.signalLine.length).toBe(result.macdLine.length - 8);
    expect(result.histogram.length).toBe(result.signalLine.length);
    // Histogram value equals macd - signal at matching times.
    const macdAt = new Map(result.macdLine.map((p) => [p.time, p.value]));
    const sigAt = new Map(result.signalLine.map((p) => [p.time, p.value]));
    for (const h of result.histogram) {
      expect(h.value).toBeCloseTo((macdAt.get(h.time) as number) - (sigAt.get(h.time) as number), 6);
    }
  });

  it("returns empty when there are fewer bars than the slow period", () => {
    const result = macd(candlesFromCloses([1, 2, 3]), 12, 26, 9);
    expect(result).toEqual({ macdLine: [], signalLine: [], histogram: [] });
  });
});

describe("volume", () => {
  it("colors bars by candle direction", () => {
    const candles: Candlestick[] = [
      { time: 0 as UTCTimestamp, open: 1, high: 2, low: 1, close: 2, volume: 10 },
      { time: 60 as UTCTimestamp, open: 2, high: 2, low: 1, close: 1, volume: 20 },
    ];
    const result = volume(candles);
    expect(result[0]).toMatchObject({ value: 10, color: UP_COLOR });
    expect(result[1]).toMatchObject({ value: 20, color: DOWN_COLOR });
  });

  it("treats missing volume as zero", () => {
    const candles: Candlestick[] = [
      { time: 0 as UTCTimestamp, open: 1, high: 2, low: 1, close: 2 },
    ];
    expect(volume(candles)[0].value).toBe(0);
  });
});
