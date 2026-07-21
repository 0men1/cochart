import { ExchangeAdapter } from "../ExchangeAdapter";
import { TickData } from "../types";

// Binance.US live stream: binance.com is geo-blocked from US IPs. Streams are
// named "<lowercasesymbol>@ticker"; our product ids ("BTCUSDT") map directly.
export class BinanceExchange extends ExchangeAdapter {
	private msgId = 0;

	constructor() {
		super({
			name: 'Binance',
			wsUrl: 'wss://stream.binance.us:9443/ws'
		});
	}

	formatSubscribeMessage(symbols: string[]) {
		return {
			method: 'SUBSCRIBE',
			params: symbols.map((s) => `${s.toLowerCase()}@ticker`),
			id: ++this.msgId
		};
	}

	formatUnsubscribeMessage(symbols: string[]) {
		return {
			method: 'UNSUBSCRIBE',
			params: symbols.map((s) => `${s.toLowerCase()}@ticker`),
			id: ++this.msgId
		};
	}

	parseTickerMessage(data: any): TickData | null {
		// Ignore subscribe/unsubscribe acks ({ result: null, id }) and any non
		// 24h-ticker frame.
		if (data.e !== '24hrTicker' || !data.c || !data.s) {
			return null;
		}

		return {
			symbol: data.s,
			price: parseFloat(data.c),
			timestamp: Math.floor(Number(data.E) / 1000),
			volume: data.v != null ? parseFloat(data.v) : undefined,
			size: data.Q != null ? parseFloat(data.Q) : undefined,
			bid: data.b != null ? parseFloat(data.b) : undefined,
			ask: data.a != null ? parseFloat(data.a) : undefined
		};
	}
}
