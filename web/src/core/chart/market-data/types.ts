import { UTCTimestamp } from "cochart-charts";
import type { Candlestick as WireCandlestick } from "@cochart/protocol";
export type Candlestick = Omit<WireCandlestick, "time"> & { time: UTCTimestamp };

export interface TickData {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  size?: number;
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

export type IntervalKey = '1m' | '5m' | '15m' | '1H' | '6H' | '1D';

// Supported timeframe → seconds map, shared with the server via the protocol.
export { INTERVAL_SECONDS } from "@cochart/protocol";
