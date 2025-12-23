import { UTCTimestamp } from "lightweight-charts";
import { Candlestick } from "./types";

export async function fetchHistoricalCandles(ticker: string, timeframe: string, start: number, end: number): Promise<Candlestick[]> {
    const s = Math.floor(start);
    const e = Math.floor(end);

    if (s > e) {
        console.error("Invalid start/end time: ", s, e);
        return [];
    }

    const raw: number[][] = await fetch(`/api/candles?symbol=${ticker}&timeframe=${timeframe}&start=${s}&end=${e}`)
        .then(res => {
            if (!res.ok) console.error("Failed to fetch candles: ", res.statusText);
            return res.json();
        });

    return raw.map(([time, low, high, open, close, volume]) => ({
        time: time as UTCTimestamp, open, high, low, close, volume
    }));
}

