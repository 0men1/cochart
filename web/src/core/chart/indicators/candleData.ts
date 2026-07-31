// Module-level singleton exposing the chart's current (sorted) candle array to
// the indicator layer, mirroring the active-interval singleton in interval.ts.
// The candle data itself lives in useCandleChart's refs; it publishes here on
// every setData/update so indicators can recompute without threading the array
// through the store (which would clone a large array on every tick under immer).

import { Candlestick } from "@/core/chart/market-data/types";
import { logger } from "@cochart/protocol";

let candles: Candlestick[] = [];
const subscribers = new Set<(candles: Candlestick[]) => void>();

export function setCandleData(next: Candlestick[]) {
  candles = next;
  for (const cb of subscribers) {
    try {
      cb(candles);
    } catch (e) {
      logger.error("candleData subscriber failed:", e);
    }
  }
}

export function getCandleData(): Candlestick[] {
  return candles;
}

export function subscribeCandleData(cb: (candles: Candlestick[]) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
