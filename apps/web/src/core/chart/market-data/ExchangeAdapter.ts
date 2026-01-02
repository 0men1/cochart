import { ExchangeConfig, ConnectionStatus, TickData, ConnectionState } from "./types";

export abstract class ExchangeAdapter {
	private ws: WebSocket | null = null;

	// State
	private subscriptions = new Map<string, Set<(data: TickData) => void>>();
	private stateListeners = new Set<(status: ConnectionState) => void>();
	private lastDataTime = 0;

	// Reconnection & Heartbeat
	private reconnectAttempts = 0;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private isManuallyDisconnected = false;

	// Batching
	private pendingSubscribe = new Set<string>();
	private pendingUnsubscribe = new Set<string>();
	private flushTimeout: NodeJS.Timeout | null = null;

	constructor(protected config: ExchangeConfig) { }

	abstract formatSubscribeMessage(symbols: string[]): object;
	abstract formatUnsubscribeMessage(symbols: string[]): object;
	abstract parseTickerMessage(data: any): TickData | null;

	connect(): void {
		if (this.isManuallyDisconnected) return;

		this.cleanup();
		this.notifyState(ConnectionStatus.CONNECTING);

		try {
			this.ws = new WebSocket(this.config.wsUrl);
			this.setupEventHandlers();
			this.startHeartbeat();
		} catch (error) {
			this.handleError(`Init failed: ${error}`);
			this.scheduleReconnect(); // Ensure retry on synchronous fail
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
		const normalized = this.normalizeSymbol(symbol);

		if (!this.subscriptions.has(normalized)) {
			this.subscriptions.set(normalized, new Set());
			// Queue for batch sending
			this.queueSubscription(normalized, 'sub');
		}

		this.subscriptions.get(normalized)?.add(onTick);

		return () => {
			const handlers = this.subscriptions.get(normalized);
			if (handlers) {
				handlers.delete(onTick);
				if (handlers.size === 0) {
					this.subscriptions.delete(normalized);
					this.queueSubscription(normalized, 'unsub');
				}
			}
		};
	}

	onStatusChange(callback: (status: ConnectionState) => void): () => void {
		this.stateListeners.add(callback);
		// Immediately notify current state
		callback(this.getCurrentState());
		return () => this.stateListeners.delete(callback);
	}

	protected setupEventHandlers(): void {
		if (!this.ws) return;

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			this.notifyState(ConnectionStatus.CONNECTED);
			this.resubscribeAll();
		};

		this.ws.onmessage = (event) => {
			this.lastDataTime = Date.now();
			try {
				const data = JSON.parse(event.data as string);
				const ticker = this.parseTickerMessage(data);
				if (ticker) {
					this.subscriptions.get(ticker.symbol)?.forEach(cb => cb(ticker));
				}
			} catch (e) {
				console.error(`[${this.config.name}] Parse error`, e);
			}
		};

		this.ws.onerror = () => this.handleError("WebSocket error");

		this.ws.onclose = () => {
			this.cleanup();
			if (!this.isManuallyDisconnected) this.scheduleReconnect();
		};
	}

	// --- Batching Logic ---
	private queueSubscription(symbol: string, type: 'sub' | 'unsub') {
		if (type === 'sub') {
			this.pendingUnsubscribe.delete(symbol); // Cancel pending unsub if resubscribing
			this.pendingSubscribe.add(symbol);
		} else {
			this.pendingSubscribe.delete(symbol); // Cancel pending sub
			this.pendingUnsubscribe.add(symbol);
		}

		if (!this.flushTimeout) {
			this.flushTimeout = setTimeout(() => this.flushPendingOps(), 50); // 50ms buffer
		}
	}

	private flushPendingOps() {
		this.flushTimeout = null;

		if (this.ws?.readyState !== WebSocket.OPEN) return;

		if (this.pendingSubscribe.size > 0) {
			const symbols = Array.from(this.pendingSubscribe);
			this.ws.send(JSON.stringify(this.formatSubscribeMessage(symbols)));
			this.pendingSubscribe.clear();
		}

		if (this.pendingUnsubscribe.size > 0) {
			const symbols = Array.from(this.pendingUnsubscribe);
			this.ws.send(JSON.stringify(this.formatUnsubscribeMessage(symbols)));
			this.pendingUnsubscribe.clear();
		}
	}

	// --- Heartbeat Logic ---
	private startHeartbeat() {
		if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

		// Check every 5s, kill if no data for 30s
		this.heartbeatInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				const silence = Date.now() - this.lastDataTime;
				if (silence > 30000 && this.subscriptions.size > 0) {
					this.handleError("Connection stale (no data >30s)");
					this.ws.close(); // Triggers onclose -> scheduleReconnect
				}
			}
		}, 5000);
	}

	private resubscribeAll() {
		const symbols = Array.from(this.subscriptions.keys());
		if (symbols.length > 0) {
			this.ws?.send(JSON.stringify(this.formatSubscribeMessage(symbols)));
		}
	}

	private scheduleReconnect(): void {
		const { maxAttempts = 10, initialDelay = 1000, maxDelay = 30000 } = this.config.reconnectConfig || {};

		if (this.reconnectAttempts >= maxAttempts) {
			this.notifyState(ConnectionStatus.ERROR, `Max retries (${maxAttempts}) reached`);
			return;
		}

		this.reconnectAttempts++;
		this.notifyState(ConnectionStatus.RECONNECTING);

		const delay = Math.min(initialDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
		this.reconnectTimeout = setTimeout(() => this.connect(), delay);
	}

	private cleanup(): void {
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
		if (this.flushTimeout) clearTimeout(this.flushTimeout);
	}

	private handleError(error: string): void {
		this.notifyState(ConnectionStatus.ERROR, error);
	}

	private getCurrentState(): ConnectionState {
		return {
			status: this.ws?.readyState === WebSocket.OPEN ? ConnectionStatus.CONNECTED : ConnectionStatus.CONNECTING, // Simplified
			reconnectAttempts: this.reconnectAttempts,
			lastDataTime: this.lastDataTime
		};
	}

	private notifyState(status: ConnectionStatus, error?: string): void {
		const state: ConnectionState = {
			status,
			error,
			reconnectAttempts: this.reconnectAttempts,
			lastDataTime: this.lastDataTime
		};
		this.stateListeners.forEach(l => l(state));
	}

	protected normalizeSymbol(symbol: string): string {
		return symbol.toUpperCase();
	}
}
