import { ExchangeAdapter } from "../ExchangeAdapter";
import { TickData } from "../types";

export class CoinbaseExchange extends ExchangeAdapter {
	constructor() {
		super({
			name: 'Coinbase',
			wsUrl: 'wss://ws-feed.exchange.coinbase.com'
		});
	}

	formatSubscribeMessage(symbols: string[]) {
		return {
			type: 'subscribe',
			product_ids: symbols,
			channels: ['ticker']
		};
	}

	formatUnsubscribeMessage(symbols: string[]) {
		return {
			type: 'unsubscribe',
			product_ids: symbols,
			channels: ['ticker']
		};
	}

	parseTickerMessage(data: any): TickData | null {
		if (data.type !== 'ticker' || !data.price || !data.product_id) {
			return null;
		}

		return {
			symbol: data.product_id,
			price: parseFloat(data.price),
			timestamp: Math.floor(new Date(data.time || Date.now()).getTime() / 1000),
			volume: data.volume_24h ? parseFloat(data.volume_24h) : undefined,
			bid: data.best_bid ? parseFloat(data.best_bid) : undefined,
			ask: data.best_ask ? parseFloat(data.best_ask) : undefined
		}
	}
}
