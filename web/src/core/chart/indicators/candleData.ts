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
