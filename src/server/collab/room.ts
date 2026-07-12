import type { Client } from "./client";
import {
  type ChartSelection,
  CollabAction,
  type Drawing,
  type IncomingAction,
} from "./protocol";
import type { RoomManager } from "./roomManager";

interface RoomState {
  seeded: boolean;
  chart: ChartSelection | null;
  drawings: Map<string, Drawing>;
}

export class Room {
  clients = new Set<Client>();

  // The single source of truth for this room.
  private state: RoomState = {
    seeded: false,
    chart: null,
    drawings: new Map(),
  };

  constructor(
    public id: string,
    private manager: RoomManager,
  ) { }

  register(client: Client): void {
    this.clients.add(client);
    client.start();

    console.log(
      `User joined: ${client.displayName} (Room: ${this.id}, Total: ${this.clients.size})`,
    );

    // Bring the newcomer up to the room's authoritative state first...
    if (this.state.seeded) {
      client.send(this.snapshotMessage());
    }

    // ...then hand everyone (including the newcomer) the updated roster.
    this.broadcastToAll(this.presenceMessage());
  }

  unregister(client: Client): void {
    if (!this.clients.has(client)) return;
    this.clients.delete(client);

    try {
      client.conn.close();
    } catch {
      // already closed
    }

    if (this.clients.size === 0) {
      console.log(`Room ${this.id} empty, cleaning up`);
      this.manager.removeRoom(this.id);
      return;
    }

    this.broadcastToAll(this.presenceMessage());
  }

  private presenceMessage(): string {
    return JSON.stringify({
      type: CollabAction.PRESENCE,
      payload: {
        users: Array.from(this.clients, (c) => ({
          userId: c.userId,
          displayName: c.displayName,
          color: c.color,
        })),
        count: this.clients.size,
      },
    });
  }

  // Applies an incoming message to the room's truth, then relays it to the
  // other clients. Unparseable messages are relayed as-is.
  handleMessage(raw: string, sender: Client): void {
    let action: IncomingAction;
    try {
      action = JSON.parse(raw);
    } catch {
      this.broadcastToOthers(raw, sender);
      return;
    }

    switch (action.type) {
      case CollabAction.INIT_ROOM: {
        // First seed wins; ignore later seeds so a late joiner can't
        // overwrite the truth.
        if (this.state.seeded) return;
        this.state.seeded = true;
        this.state.chart = {
          product: action.payload?.product,
          timeframe: action.payload?.timeframe,
        };
        this.state.drawings = new Map(
          (action.payload?.drawings ?? []).map((d) => [d.id, d]),
        );
        // Covers the rare case where someone joined before the seed arrived.
        this.broadcastToOthers(this.snapshotMessage(), sender);
        return;
      }
      case CollabAction.SELECT_CHART: {
        this.state.seeded = true;
        this.state.chart = {
          product: action.payload?.product,
          timeframe: action.payload?.timeframe,
        };
        break;
      }
      case CollabAction.ADD_DRAWING:
      case CollabAction.MODIFY_DRAWING: {
        const drawing = action.payload?.drawing;
        if (drawing?.id) {
          this.state.seeded = true;
          this.state.drawings.set(drawing.id, drawing);
        }
        break;
      }
      case CollabAction.DELETE_DRAWING: {
        const drawingId = action.payload?.drawingId;
        if (drawingId) this.state.drawings.delete(drawingId);
        break;
      }
      default:
        break;
    }

    this.broadcastToOthers(raw, sender);
  }

  private snapshotMessage(): string {
    return JSON.stringify({
      type: CollabAction.SNAPSHOT,
      payload: {
        product: this.state.chart?.product ?? null,
        timeframe: this.state.chart?.timeframe ?? null,
        drawings: Array.from(this.state.drawings.values()),
      },
    });
  }

  broadcastToAll(message: string): void {
    for (const client of this.clients) {
      client.send(message);
    }
  }

  broadcastToOthers(message: string, sender: Client): void {
    for (const client of this.clients) {
      if (client === sender) continue;
      client.send(message);
    }
  }
}
