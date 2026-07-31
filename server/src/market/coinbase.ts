import type { Candlestick, ExchangeProvider, Product } from "./types";

const USER_AGENT = "Cochart-App";

interface CoinbaseProduct {
  id: string;
  quote_currency: string;
  base_currency: string;
  display_name: string;
  status: string;
}

export class CoinbaseProvider implements ExchangeProvider {
  constructor(private baseURL = "https://api.exchange.coinbase.com") { }

  id(): string {
    return "coinbase";
  }

  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${this.baseURL}/products`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`coinbase status: ${res.status}`);
    }

    const raw = (await res.json()) as CoinbaseProduct[];

    const products: Product[] = [];
    for (const p of raw) {
      if (p.status !== "online") continue;
      products.push({
        id: p.id,
        name: p.base_currency + p.quote_currency,
        type: "crypto",
        exchange: "coinbase",
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
    // API Docs: /products/{product_id}/candles
    const url =
      `${this.baseURL}/products/${symbol}/candles` +
      `?granularity=${granularity}&start=${start}&end=${end}`;

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`coinbase error ${res.status}: ${body}`);
    }

    // Coinbase returns an array of arrays:
    // [ [ time, low, high, open, close, volume ], ... ]
    const raw = (await res.json()) as number[][];

    const candles: Candlestick[] = [];
    for (const c of raw) {
      if (c.length >= 6) {
        candles.push({
          time: Math.trunc(c[0]),
          low: c[1],
          high: c[2],
          open: c[3],
          close: c[4],
          volume: c[5],
        });
      }
    }

    // Coinbase returns newest first; we want oldest first.
    candles.sort((a, b) => a.time - b.time);
    return candles;
  }
}
