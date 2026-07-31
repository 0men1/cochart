import type { Candlestick, ExchangeProvider, Product } from "./types";

const USER_AGENT = "Cochart-App";

interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface BinanceExchangeInfo {
  symbols: BinanceSymbol[];
}

// Binance kline intervals are strings; unlike Kraken it has a native 6H bucket.
export function binanceInterval(granularity: number): string | null {
  switch (granularity) {
    case 60: return "1m";
    case 300: return "5m";
    case 900: return "15m";
    case 3600: return "1h";
    case 21600: return "6h";
    case 86400: return "1d";
    default: return null;
  }
}

// Parses Binance klines into ascending candles. Rows are
// [openTime(ms), open, high, low, close, volume, closeTime, ...] with string
// numbers; Binance already returns them oldest-first.
export function parseBinanceKlines(raw: unknown[][]): Candlestick[] {
  const candles: Candlestick[] = [];
  for (const row of raw) {
    if (row.length >= 6) {
      candles.push({
        time: Math.trunc(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      });
    }
  }
  return candles;
}

export class BinanceProvider implements ExchangeProvider {
  // Binance.US endpoints: binance.com returns HTTP 451 from US IPs.
  constructor(private baseURL = "https://api.binance.us/api/v3") { }

  id(): string {
    return "binance";
  }

  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${this.baseURL}/exchangeInfo`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`binance status: ${res.status}`);
    }

    const body = (await res.json()) as BinanceExchangeInfo;

    const products: Product[] = [];
    for (const s of body.symbols ?? []) {
      if (s.status !== "TRADING") continue;
      products.push({
        id: s.symbol,
        name: s.baseAsset + s.quoteAsset,
        type: "crypto",
        exchange: "binance",
      });
    }
    return products;
  }

  async fetchCandles(
    symbol: string,
    start: number,
    end: number,
    granularity: number,
    signal?: AbortSignal,
  ): Promise<Candlestick[]> {
    const interval = binanceInterval(granularity);
    if (interval === null) return [];

    // Binance uses millisecond timestamps and honors start/end, so deep-history
    // backfill works. limit=1000 comfortably covers MarketService's 300/block.
    const url =
      `${this.baseURL}/klines` +
      `?symbol=${encodeURIComponent(symbol)}&interval=${interval}` +
      `&startTime=${start * 1000}&endTime=${end * 1000}&limit=1000`;

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`binance error ${res.status}: ${body}`);
    }

    return parseBinanceKlines((await res.json()) as unknown[][]);
  }
}
