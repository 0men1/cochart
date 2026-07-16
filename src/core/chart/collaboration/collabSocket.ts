import { getBaseSocketUrl } from "@/lib/utils";
import type { Identity } from "@/lib/identity";

export class CollabSocket {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private identity: Identity | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private intentionalClose: boolean = false;

  connect(roomId: string, identity: Identity | null, callbacks: {
    onOpen: () => void;
    onMessage: (data: any) => void;
    onClose: () => void;
    onError: (error: Event) => void;
    onReconnecting?: () => void;
  }) {
    const params = new URLSearchParams({ roomId });
    if (identity) {
      params.set("userId", identity.userId);
      params.set("displayName", identity.displayName);
      params.set("color", identity.color);
    }
    this.ws = new WebSocket(`${getBaseSocketUrl()}/api/rooms/join?${params.toString()}`)
    this.roomId = roomId;
    this.identity = identity;

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
        // Signal that a retry is pending so the UI can distinguish a transient
        // drop from a terminal failure (which leaves status at ERROR).
        callbacks.onReconnecting?.();
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        setTimeout(() => {
          this.reconnectAttempts++;
          if (this.roomId) {
            this.connect(this.roomId, this.identity, callbacks);
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

}
