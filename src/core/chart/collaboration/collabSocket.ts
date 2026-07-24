import { getBaseSocketUrl } from "@/lib/utils";
import type { Identity } from "@/lib/identity";
import { CollabAction } from "@/stores/types";

export class CollabSocket {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private identity: Identity | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private intentionalClose: boolean = false;
  // Set when the server refused the join because the user is already at their
  // room cap. Suppresses auto-reconnect so we don't fight the limit in a loop.
  private roomLimited: boolean = false;

  connect(roomId: string, identity: Identity | null, callbacks: {
    onOpen: () => void;
    onMessage: (data: any) => void;
    onClose: () => void;
    onError: (error: Event) => void;
    onReconnecting?: () => void;
    onRoomLimit?: (payload: any) => void;
  }, force: boolean = false) {
    // Fresh attempt: clear the terminal flags so a confirmed force-join (or a
    // later reconnect) isn't blocked by a previous close.
    this.intentionalClose = false;
    this.roomLimited = false;

    const params = new URLSearchParams({ roomId });
    if (identity) {
      params.set("userId", identity.userId);
      params.set("displayName", identity.displayName);
      params.set("color", identity.color);
    }
    // Force-join: tell the server to evict the user's other room(s) for this one.
    if (force) params.set("force", "1");
    this.ws = new WebSocket(`${getBaseSocketUrl()}/api/rooms/join?${params.toString()}`)
    this.roomId = roomId;
    this.identity = identity;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      callbacks.onOpen();
    }

    this.ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      // The server refused the join (user already in another room). Surface it
      // for the prompt and stop here — the socket is about to be closed and we
      // must not auto-reconnect into the same refusal.
      if (data?.type === CollabAction.ROOM_LIMIT) {
        this.roomLimited = true;
        this.intentionalClose = true;
        callbacks.onRoomLimit?.(data.payload);
        return;
      }
      callbacks.onMessage(data)
    }

    this.ws.onclose = () => {
      callbacks.onClose();
    }

    this.ws.onerror = (error: Event) => {
      callbacks.onError(error);

      // Auto-reconnect with exponential backoff (never after an intentional
      // close or a room-limit refusal).
      if (!this.intentionalClose && !this.roomLimited && this.reconnectAttempts < this.maxReconnectAttempts) {
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
