import { ExchangeConfig, ConnectionStatus, TickData, ConnectionState } from "./types";

export abstract class ExchangeAdapter {
    private ws: WebSocket | null = null;

    private subscriptions = new Map<string, Set<(data: TickData) => void>>();
    private stateListeners = new Set<(status: ConnectionState) => void>();

    private reconnectAttempts = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    private isManuallyDisconnected = false;

    constructor(protected config: ExchangeConfig) { }

    abstract formatSubscribeMessage(symbols: string[]): object;
    abstract formatUnsubscribeMessage(symbols: string[]): object;
    abstract parseTickerMessage(data: any): TickData | null;

    connect(): void {
        if (this.isManuallyDisconnected) return;

        this.cleanup();
        this.notifyState(ConnectionStatus.CONNECTING)

        try {
            this.ws = new WebSocket(this.config.wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            this.handleError(`failed to create WebSocket connection: ${error}`);
        }
    }

    disconnect(): void {
        this.isManuallyDisconnected = true;
        this.cleanup();
        this.ws?.close();
        this.ws = null;
        this.notifyState(ConnectionStatus.DISCONNECTED);
    }

    subscribe(symbol: string, onTick: (data: TickData) => void): () => void {
        const normalizedSymbol = this.normalizeSymbol(symbol);

        if (!this.subscriptions.has(normalizedSymbol)) {
            this.subscriptions.set(normalizedSymbol, new Set());
            this.sendSubscription([normalizedSymbol]);
        }

        this.subscriptions.get(normalizedSymbol)?.add(onTick);

        return () => {
            const handlers = this.subscriptions.get(normalizedSymbol);
            if (handlers) {
                handlers.delete(onTick);
                if (handlers.size === 0) {
                    this.subscriptions.delete(normalizedSymbol);
                    this.sendUnsubscrption([symbol]);
                }
            }
        }
    }

    onStatusChange(callback: (status: ConnectionState) => void): () => void {
        this.stateListeners.add(callback);
        return () => this.stateListeners.delete(callback);
    }

    protected setupEventHandlers(): void {
        if (!this.ws) return;

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            this.notifyState(ConnectionStatus.CONNECTED);

            const symbols = Array.from(this.subscriptions.keys());
            if (symbols.length > 0) {
                this.sendSubscription(symbols);
            }
        }

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const tickerData = this.parseTickerMessage(data);

                if (tickerData) {

                    const handlers = this.subscriptions.get(tickerData.symbol);
                    handlers?.forEach(handler => handler(tickerData));
                }
            } catch (error) {
                console.error(`${this.config.name} parse error: `, error)
            }
        };

        this.ws.onerror = () => {
            this.handleError("Websocket connection error");
        }

        this.ws.onclose = () => {
            this.cleanup();
            if (!this.isManuallyDisconnected) {
                this.scheduleReconnect();
            }
        }
    }

    protected normalizeSymbol(symbol: string): string {
        return symbol.toUpperCase();
    }

    protected sendSubscription(symbols: string[]): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const message = this.formatSubscribeMessage(symbols);
            this.ws.send(JSON.stringify(message));
        }
    }

    protected sendUnsubscrption(symbols: string[]): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const message = this.formatUnsubscribeMessage(symbols);
            this.ws.send(JSON.stringify(message));
        }
    }

    private scheduleReconnect(): void {
        const maxAttempts = this.config.reconnectConfig?.maxAttempts ?? 10;

        if (this.reconnectAttempts >= maxAttempts) {
            this.handleError(`Failed to connect after ${maxAttempts} attempts`);
            return;
        }

        this.reconnectAttempts++;
        this.notifyState(ConnectionStatus.RECONNECTING);

        const initialDelay = this.config.reconnectConfig?.initialDelay ?? 10;
        const maxDelay = this.config.reconnectConfig?.maxDelay ?? 30000;
        const delay = Math.min(initialDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay)

        this.reconnectTimeout = setTimeout(() => this.connect(), delay)
    }

    private cleanup(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null;
        }
    }

    private handleError(error: string): void {
        this.notifyState(ConnectionStatus.ERROR, error)
    }

    private notifyState(status: ConnectionStatus, error?: string): void {
        const fullState: ConnectionState = {
            status,
            error: error,
            reconnectAttempts: this.reconnectAttempts,
        };
        this.stateListeners.forEach(listener => listener(fullState))
    }

    destroy(): void {
        this.disconnect();
        this.subscriptions.clear();
        this.stateListeners.clear();
    }

}
