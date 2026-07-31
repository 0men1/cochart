import { getBaseSocketUrl } from "@/lib/utils";
import { logger } from "@/lib/logger";
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
    onMessage: (data: unknown) => void;
    onClose: () => void;
    onError: (error: Event) => void;
    onReconnecting?: () => void;
  }) {
    this.intentionalClose = false;

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
      // A malformed frame must not throw inside the handler; log and drop it.
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        logger.error("Dropped malformed collab frame:", err);
        return;
      }
      callbacks.onMessage(data)
    }

    this.ws.onerror = (error: Event) => {
      // Surface the error; reconnection is driven from onclose (which reliably
      // fires on both clean and abnormal drops), not from here.
      callbacks.onError(error);
    }

    this.ws.onclose = (event: CloseEvent) => {
      callbacks.onClose();

      // Don't reconnect after an intentional disconnect, a normal close (1000),
      // or a server policy close such as "room not found" (1008) — retrying
      // those just loops into the same result.
      const terminal = this.intentionalClose || event.code === 1000 || event.code === 1008;
      if (!terminal && this.reconnectAttempts < this.maxReconnectAttempts) {
        // Signal that a retry is pending so the UI can distinguish a transient
        // drop from a terminal failure.
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

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect() {
    if (this.ws) {
      this.intentionalClose = true;
      this.ws.close(1000, "User Disconnected");
      this.ws = null;
      this.roomId = null;
    }
  }

  getState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}
