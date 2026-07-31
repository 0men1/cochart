// Server-side market data types. JSON shapes here must match what the web
// client expects (see src/core/chart/market-data/types.ts).

export interface Candlestick {
	// Serialized as `time` to match the client's Candlestick shape.
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

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
