import type { Candlestick, ExchangeProvider, Product } from "./types";

const USER_AGENT = "Cochart-App";

interface KrakenAssetPair {
	altname: string;
	wsname?: string;
	base: string;
	quote: string;
	status: string;
}

interface KrakenAssetPairsResponse {
	error?: string[];
	result: Record<string, KrakenAssetPair>;
}

interface KrakenOHLCResponse {
	error?: string[];
	result: Record<string, unknown>;
}

// Kraken OHLC only exposes a fixed set of intervals (in minutes). It has no 6H
// bucket, so 21600s returns null and the provider yields an empty series for
// that timeframe (a documented gap rather than mislabeled 4H data).
export function krakenInterval(granularity: number): number | null {
	switch (granularity) {
		case 60: return 1;
		case 300: return 5;
		case 900: return 15;
		case 3600: return 60;
		case 86400: return 1440;
		default: return null;
	}
}

// Parses a Kraken OHLC response into ascending candles. Kraken keys the result
// by its canonical pair name (plus a `last` cursor), and each row is
// [time, open, high, low, close, vwap, volume, count] with string numbers — note
// the O/H/L/C order and that volume lives at index 6 (vwap is at 5).
export function parseKrakenOHLC(json: KrakenOHLCResponse): Candlestick[] {
	if (json.error?.length) {
		throw new Error(`kraken error: ${json.error.join(", ")}`);
	}
	const key = Object.keys(json.result ?? {}).find((k) => k !== "last");
	if (!key) return [];
	const rows = json.result[key] as unknown[][];

	const candles: Candlestick[] = [];
	for (const row of rows) {
		if (row.length >= 7) {
			candles.push({
				time: Math.trunc(Number(row[0])),
				open: Number(row[1]),
				high: Number(row[2]),
				low: Number(row[3]),
				close: Number(row[4]),
				volume: Number(row[6]),
			});
		}
	}
	candles.sort((a, b) => a.time - b.time);
	return candles;
}

export class KrakenProvider implements ExchangeProvider {
	constructor(private baseURL = "https://api.kraken.com") {}

	id(): string {
		return "kraken";
	}

	async getProducts(): Promise<Product[]> {
		const res = await fetch(`${this.baseURL}/0/public/AssetPairs`, {
			headers: { "User-Agent": USER_AGENT },
		});

		if (!res.ok) {
			throw new Error(`kraken status: ${res.status}`);
		}

		const body = (await res.json()) as KrakenAssetPairsResponse;
		if (body.error?.length) {
			throw new Error(`kraken error: ${body.error.join(", ")}`);
		}

		const products: Product[] = [];
		for (const pair of Object.values(body.result)) {
			// Skip pairs without a WS name (e.g. dark-pool ".d" pairs); the wsname
			// is what the live adapter subscribes with, and we use it as the id.
			if (pair.status !== "online" || !pair.wsname) continue;
			products.push({
				id: pair.wsname,
				name: pair.wsname.replace("/", ""),
				type: "crypto",
				exchange: "kraken",
			});
		}
		return products;
	}

	async fetchCandles(
		symbol: string,
		start: number,
		_end: number,
		granularity: number,
		signal?: AbortSignal,
	): Promise<Candlestick[]> {
		const interval = krakenInterval(granularity);
		if (interval === null) return [];

		// REST takes the slash-less pair (e.g. "XBTUSD"); Kraken resolves it to the
		// canonical key we read back in parseKrakenOHLC. `since` bounds the start;
		// Kraken ignores an end and caps the response at ~720 candles, and
		// MarketService filters the merged result to the requested window.
		const pair = symbol.replace("/", "");
		const url =
			`${this.baseURL}/0/public/OHLC` +
			`?pair=${encodeURIComponent(pair)}&interval=${interval}&since=${start}`;

		const res = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal,
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`kraken error ${res.status}: ${body}`);
		}

		return parseKrakenOHLC((await res.json()) as KrakenOHLCResponse);
	}
}
