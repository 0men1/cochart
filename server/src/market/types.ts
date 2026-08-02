import type { Candlestick } from "@cochart/protocol";
export type { Candlestick } from "@cochart/protocol"

export interface Product {
  id: string;
  name: string;
  type: string;
  exchange: string;
}

export interface ExchangeProvider {
  id(): string;
  fetchCandles(
    symbol: string,
    start: number,
    end: number,
    granularity: number,
    signal?: AbortSignal,
  ): Promise<Candlestick[]>;
  getProducts(): Promise<Product[]>;
}
