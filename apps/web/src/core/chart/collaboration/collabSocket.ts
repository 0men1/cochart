import { getBaseSocketUrl } from "@/lib/utils";

export class CollabSocket {
    private ws: WebSocket | null = null;
    private roomId: string | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private intentionalClose: boolean = false;

    connect(roomId: string, callbacks: {
        onOpen: () => void;
        onMessage: (data: any) => void;
        onClose: () => void;
        onError: (error: Event) => void;
    }) {
        this.ws = new WebSocket(`${getBaseSocketUrl()}/rooms/join?roomId=${roomId}`)
        this.roomId = roomId;

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            callbacks.onOpen();
        }

        this.ws.onmessage = (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            callbacks.onMessage(data)
        }

        this.ws.onclose = () => {
            callbacks.onClose();
        }

        this.ws.onerror = (error: Event) => {
            callbacks.onError(error);

            // Auto-reconnect with exponential backoff
            if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.pow(2, this.reconnectAttempts) * 1000;
                setTimeout(() => {
                    this.reconnectAttempts++;
                    if (this.roomId) {
                        this.connect(this.roomId, callbacks);
                    }
                }, delay);
            }
        }
    }

    send(data: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data))
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws?.close(1000, "User Disconnected");
            this.ws = null;
            this.roomId = null;
            this.intentionalClose = true;
        }
    }

    getState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }


    /*
     *
    private handleReconnect(roomId: string, onMessage: (op: Operation) => void) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connect(roomId, onMessage)
            }, Math.pow(2, this.reconnectAttempts) * 1000)
        }
    }
     * */
}
