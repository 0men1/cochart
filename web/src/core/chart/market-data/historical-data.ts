import { UTCTimestamp } from "cochart-charts";
import { logger } from "@cochart/protocol";
import { Candlestick } from "./types";

export async function fetchHistoricalCandles(ticker: string, provider: string, timeframe: string, start: number, end: number): Promise<Candlestick[]> {
  const s = Math.floor(start);
  const e = Math.floor(end);

  if (s > e) {
    logger.error("Invalid start/end time: ", s, e);
    return [];
  }

  const res = await fetch(`/api/candles?symbol=${ticker}&timeframe=${timeframe}&provider=${provider}&start=${s}&end=${e}`);

  if (!res.ok) {
    logger.error("Failed to fetch candles: ", res.status, res.statusText);
    return [];
  }

  const raw: Candlestick[] = await res.json();
  if (!Array.isArray(raw)) {
    logger.error("Unexpected candles payload (not an array)");
    return [];
  }

  return raw.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume
  }));
}
