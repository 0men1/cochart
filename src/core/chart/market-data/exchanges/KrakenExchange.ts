import { ExchangeAdapter } from "../ExchangeAdapter";
import { TickData } from "../types";

// Kraken WebSocket v1 subscribes with the pair's `wsname` (e.g. "XBT/USD"), which
// is exactly the id our KrakenProvider stores. (v2 uses normalized names like
// "BTC/USD" that don't match Kraken's REST wsname, so v1 keeps one symbol working
// across both the live feed and historical fetch.)
export class KrakenExchange extends ExchangeAdapter {
	constructor() {
		super({
			name: 'Kraken',
			wsUrl: 'wss://ws.kraken.com'
		});
	}

	formatSubscribeMessage(symbols: string[]) {
		return {
			event: 'subscribe',
			pair: symbols,
			subscription: { name: 'ticker' }
		};
	}

	formatUnsubscribeMessage(symbols: string[]) {
		return {
			event: 'unsubscribe',
			pair: symbols,
			subscription: { name: 'ticker' }
		};
	}

	parseTickerMessage(data: any): TickData | null {
		// Ticker updates arrive as arrays: [channelID, payload, "ticker", pair].
		// Status/heartbeat frames are plain objects and are ignored.
		if (!Array.isArray(data) || data.length < 4 || data[2] !== 'ticker') {
			return null;
		}
		const payload = data[1];
		const pair = data[3];
		if (!payload?.c || !pair) {
			return null;
		}

		// Kraken arrays: c=[lastPrice, lastLotVolume], b/a=[price, wholeLot, lot],
		// v=[today, last24h].
		return {
			symbol: pair,
			price: parseFloat(payload.c[0]),
			timestamp: Math.floor(Date.now() / 1000),
			volume: payload.v ? parseFloat(payload.v[1]) : undefined,
			size: payload.c[1] ? parseFloat(payload.c[1]) : undefined,
			bid: payload.b ? parseFloat(payload.b[0]) : undefined,
			ask: payload.a ? parseFloat(payload.a[0]) : undefined
		};
	}
}
