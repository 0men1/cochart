import { UTCTimestamp } from "lightweight-charts";

export type Candlestick = {
    time: UTCTimestamp,
    open: number,
    high: number,
    low: number,
    close: number,
    volume?: number
}

export interface TickData {
    symbol: string;
    price: number;
    timestamp: number;
    volume?: number;
    bid?: number;
    ask?: number;
}

export interface ExchangeConfig {
    name: string;
    wsUrl: string;
    reconnectConfig?: {
        maxAttempts?: number;
        initialDelay?: number;
        maxDelay?: number;
    };
}

export interface SubscriptionRequest {
    symbol: string;
    onTick: (data: TickData) => void;
    onError?: (error: string) => void;
}

export enum ConnectionStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    ERROR = 'error'
}

export interface ConnectionState {
    status: ConnectionStatus;
    reconnectAttempts: number;
    lastDataTime?: number;
    error?: string;
}


// export enum ExchangeType {
//     coinbase,
//     binance,
//     kraken
// }

export type ExchangeType = "coinbase" | "binance" | "kraken"


export type IntervalKey = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W';

export const INTERVALMs: Record<string, number> = {
    "1m": 60,
    '5m': 5 * 60,
    '15m': 15 * 60,
    '1H': 60 * 60,
    '4H': 4 * 60 * 60,
    '1D': 24 * 60 * 60,
    '1W': 24 * 7 * 60 * 60
}
