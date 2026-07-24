import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebSocket } from "ws";
import { Client } from "./client";
import { CollabAction } from "./protocol";
import { Room } from "./room";
import { getRoomLimit } from "./roomLimit";
import type { RoomManager } from "./roomManager";

let i = 1;

// Fallback colors for connections that don't supply one (older clients).
const FALLBACK_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e",
];

// POST /api/rooms/create
export function handleCreateRoom(
  res: ServerResponse,
  manager: RoomManager,
): void {
  const roomId = randomUUID();
  const room = new Room(roomId, manager);
  manager.addRoom(room);

  logger.debug(`Created room: ${roomId}`);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ roomId, url: `/chart/room/${roomId}` }));
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
  const force = url.searchParams.get("force") === "1";

  const room = manager.getRoom(roomId);
  if (!room) {
    logger.debug(`Room not found: ${roomId}`);
    ws.close(1008, "Room not found");
    return;
  }

  // Enforce the per-user concurrent-room cap. Re-joining a room the user is
  // already in (e.g. a second tab of the same room) never counts against it.
  const otherRooms = manager.roomsForUser(userId);
  otherRooms.delete(roomId);
  if (otherRooms.size >= getRoomLimit(userId)) {
    if (force) {
      // The user confirmed the switch — drop their other room(s) to make space.
      manager.evictUserFromOtherRooms(userId, roomId);
    } else {
      // Don't evict silently: tell the client so it can prompt the user, then
      // close (flushing the notice first via the send callback).
      logger.debug(`Room limit hit for ${userId}, prompting before ${roomId}`);
      ws.send(
        JSON.stringify({
          type: CollabAction.ROOM_LIMIT,
          payload: { roomId, rooms: Array.from(otherRooms), limit: getRoomLimit(userId) },
        }),
        () => ws.close(4001, "room-limit"),
      );
      return;
    }
  }

  const client = new Client(ws, displayName, room, userId, color);
  room.register(client);
}
