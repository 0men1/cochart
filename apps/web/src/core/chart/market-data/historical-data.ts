import { UTCTimestamp } from "lightweight-charts";
import { Candlestick } from "./types";

export async function fetchHistoricalCandles(ticker: string, provider: string, timeframe: string, start: number, end: number): Promise<Candlestick[]> {
    const s = Math.floor(start);
    const e = Math.floor(end);

    if (s > e) {
        console.error("Invalid start/end time: ", s, e);
        return [];
    }

    const raw: Candlestick[] = await fetch(`/api/candles?symbol=${ticker}&timeframe=${timeframe}&provider=${provider}&start=${s}&end=${e}`)
        .then(res => {
            if (!res.ok) console.error("Failed to fetch candles: ", res.statusText);
            return res.json();
        });

    return raw.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
    }));
}
