import { randomUUID } from "node:crypto";
import type { Client } from "./client";
import { logger } from "../../lib/logger";
import {
  type ChartSelection,
  type ChatMessage,
  CollabAction,
  type Drawing,
  type Indicator,
  type IncomingAction,
} from "./protocol";

interface RoomState {
  seeded: boolean;
  chart: ChartSelection | null;
  drawings: Map<string, Drawing>;
  indicators: Map<string, Indicator>;
  messages: ChatMessage[];
}

const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_COLOR_LENGTH = 32;
const MAX_CHAT_LENGTH = 500;
const MAX_CHAT_HISTORY = 200;
const MAX_DRAWINGS = 500;
const MAX_INDICATORS = 50;

export class Room {
  clients = new Set<Client>();
  readonly createdAt = Date.now();
  emptySince: number | null = Date.now();

  // The single source of truth for this room.
  private state: RoomState = {
    seeded: false,
    chart: null,
    drawings: new Map(),
    indicators: new Map(),
    messages: [],
  };

  constructor(public id: string) { }

  register(client: Client): void {
    this.clients.add(client);
    this.emptySince = null;
    client.start();
    logger.debug(
      `User joined: ${client.displayName} (Room: ${this.id}, Total: ${this.clients.size})`,
    );
    if (this.state.seeded) {
      client.send(this.snapshotMessage());
    }
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
      logger.debug(`Room ${this.id} empty, starting grace period`);
      this.emptySince = Date.now();
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
        this.state.indicators = new Map(
          (action.payload?.indicators ?? []).map((i) => [i.id, i]),
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
          const isNew = !this.state.drawings.has(drawing.id);
          if (isNew && this.state.drawings.size >= MAX_DRAWINGS) return;
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
      case CollabAction.ADD_INDICATOR:
      case CollabAction.MODIFY_INDICATOR: {
        const indicator = action.payload?.indicator;
        if (indicator?.id) {
          const isNew = !this.state.indicators.has(indicator.id);
          if (isNew && this.state.indicators.size >= MAX_INDICATORS) return;
          this.state.seeded = true;
          this.state.indicators.set(indicator.id, indicator);
        }
        break;
      }
      case CollabAction.REMOVE_INDICATOR: {
        const indicatorId = action.payload?.indicatorId;
        if (indicatorId) this.state.indicators.delete(indicatorId);
        break;
      }
      case CollabAction.UPDATE_PRESENCE: {
        const displayName = action.payload?.displayName;
        const color = action.payload?.color;
        if (typeof displayName === "string" && displayName.trim()) {
          sender.displayName = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
        }
        if (typeof color === "string" && color.trim()) {
          sender.color = color.trim().slice(0, MAX_COLOR_LENGTH);
        }
        this.broadcastToAll(this.presenceMessage());
        return;
      }
      case CollabAction.CURSOR:
      case CollabAction.DRAWING_DRAG: {
        this.broadcastToOthers(raw, sender);
        return;
      }
      case CollabAction.CHAT: {
        const text = action.payload?.text;
        if (typeof text !== "string") return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const message: ChatMessage = {
          id: randomUUID(),
          userId: sender.userId,
          displayName: sender.displayName,
          color: sender.color,
          text: trimmed.slice(0, MAX_CHAT_LENGTH),
          timestamp: Date.now(),
        };
        this.state.messages.push(message);
        if (this.state.messages.length > MAX_CHAT_HISTORY) {
          this.state.messages = this.state.messages.slice(-MAX_CHAT_HISTORY);
        }
        this.broadcastToAll(
          JSON.stringify({ type: CollabAction.CHAT, payload: { message } }),
        );
        return;
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
        indicators: Array.from(this.state.indicators.values()),
        messages: this.state.messages,
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
