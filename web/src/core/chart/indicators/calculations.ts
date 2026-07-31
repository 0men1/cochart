// Pure indicator math: each function maps candle data to the point arrays the
// charting library plots. No chart/DOM access here so the logic stays unit
// testable. Output uses the library's LineData / HistogramData shapes
// ({ time, value }, plus an optional per-bar `color` for histograms).

import { LineData, HistogramData } from "cochart-charts";
import { Candlestick } from "@/core/chart/market-data/types";

// Default histogram colors, matching the app's up/down palette.
export const UP_COLOR = "#26a69a";
export const DOWN_COLOR = "#ef5350";

// Simple moving average of close over `period` bars.
export function sma(candles: Candlestick[], period: number): LineData[] {
  if (period <= 0 || candles.length < period) return [];
  const out: LineData[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

// EMA over a raw number series, aligned to the input (null until the seed bar at
// index period-1, which is seeded with the SMA of the first `period` values).
// Shared by ema() and macd().
function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// Exponential moving average of close over `period` bars.
export function ema(candles: Candlestick[], period: number): LineData[] {
  const values = emaSeries(candles.map((c) => c.close), period);
  const out: LineData[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null) out.push({ time: candles[i].time, value: v });
  }
  return out;
}

// Volume-weighted average price. NOTE: VWAP is normally session-anchored (resets
// each trading day); this is a running cumulative over the currently-loaded
// window, which is simpler and adequate for a single continuous crypto feed.
export function vwap(candles: Candlestick[]): LineData[] {
  const out: LineData[] = [];
  let cumPV = 0;
  let cumV = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    const v = c.volume ?? 0;
    cumPV += typical * v;
    cumV += v;
    out.push({ time: c.time, value: cumV > 0 ? cumPV / cumV : typical });
  }
  return out;
}

// Relative Strength Index using Wilder's smoothing. Output is 0–100, starting at
// the first bar with a full `period` of changes.
export function rsi(candles: Candlestick[], period: number): LineData[] {
  if (period <= 0 || candles.length <= period) return [];
  const rsiFrom = (avgGain: number, avgLoss: number) =>
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;

  const out: LineData[] = [{ time: candles[period].time, value: rsiFrom(avgGain, avgLoss) }];
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const g = change > 0 ? change : 0;
    const l = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out.push({ time: candles[i].time, value: rsiFrom(avgGain, avgLoss) });
  }
  return out;
}

export interface MacdResult {
  macdLine: LineData[];
  signalLine: LineData[];
  histogram: HistogramData[];
}

// MACD: (EMA_fast - EMA_slow), its signal EMA, and the histogram of their
// difference. The MACD line is defined once the slow EMA seeds (index slow-1),
// and the signal EMA is computed over that defined region.
export function macd(candles: Candlestick[], fast: number, slow: number, signal: number): MacdResult {
  const empty: MacdResult = { macdLine: [], signalLine: [], histogram: [] };
  if (candles.length < slow) return empty;

  const closes = candles.map((c) => c.close);
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);

  const startIdx = slow - 1; // first bar where both EMAs (and thus MACD) exist
  const definedMacd: number[] = [];
  for (let i = startIdx; i < closes.length; i++) {
    definedMacd.push((fastE[i] as number) - (slowE[i] as number));
  }
  const signalE = emaSeries(definedMacd, signal); // aligned to definedMacd

  const macdLine: LineData[] = [];
  const signalLine: LineData[] = [];
  const histogram: HistogramData[] = [];
  for (let j = 0; j < definedMacd.length; j++) {
    const time = candles[startIdx + j].time;
    const m = definedMacd[j];
    macdLine.push({ time, value: m });
    const s = signalE[j];
    if (s !== null) {
      signalLine.push({ time, value: s });
      const h = m - s;
      histogram.push({ time, value: h, color: h >= 0 ? UP_COLOR : DOWN_COLOR });
    }
  }
  return { macdLine, signalLine, histogram };
}

// Per-bar volume, colored by whether the candle closed up or down.
export function volume(candles: Candlestick[]): HistogramData[] {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume ?? 0,
    color: c.close >= c.open ? UP_COLOR : DOWN_COLOR,
  }));
}
