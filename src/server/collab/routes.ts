import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebSocket } from "ws";
import { Client } from "./client";
import { Room } from "./room";
import type { RoomManager } from "./roomManager";
import { createRoomLimiter } from "../index";
import { clientIp, sendJson } from "../http";

let i = 1;

const FALLBACK_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e",
];

// POST /api/rooms/create
export function handleCreateRoom(
  req: IncomingMessage,
  res: ServerResponse,
  manager: RoomManager,
): void {
  if (!createRoomLimiter.check(clientIp(req))) {
    sendJson(res, 429, { error: "Too many rooms created. Please slow down." });
    return;
  }

  const roomId = randomUUID();
  const room = new Room(roomId, manager);
  manager.addRoom(room);

  logger.debug(`Created room: ${roomId}`);

  sendJson(res, 200, { roomId, url: `/chart/room/${roomId}` });
}

// WS /api/rooms/join — called after the socket upgrade has completed.
export function handleJoinRoom(
  ws: WebSocket,
  req: IncomingMessage,
  manager: RoomManager,
): void {
  const url = new URL(req.url ?? "", "http://localhost");
  const roomId = url.searchParams.get("roomId") ?? "";
  const seq = i++;
  const displayName = url.searchParams.get("displayName") || `Guest ${seq}`;
  const userId = url.searchParams.get("userId") || randomUUID();
  const color = url.searchParams.get("color") || FALLBACK_COLORS[seq % FALLBACK_COLORS.length];

  const room = manager.getRoom(roomId);
  if (!room) {
    logger.debug(`Room not found: ${roomId}`);
    ws.close(1008, "Room not found");
    return;
  }

  const client = new Client(ws, displayName, room, userId, color);
  room.register(client);
}
