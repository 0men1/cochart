import type { IncomingMessage, ServerResponse, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { handleCreateRoom, handleJoinRoom } from "./collab/routes";
import { handleCandles, handleSearch } from "./market/routes";
import { handleCreateSuggestion } from "./feedback/routes";
import { applyCors } from "./http";
import {
  ensureSearchIndex,
  marketService,
  roomManager,
  roomStore,
  searchEngine,
} from "./services";
import { logger } from "@cochart/protocol";

const ROOM_JOIN_PATH = "/api/rooms/join";
const MAX_WS_PAYLOAD = 256 * 1024;
const ROOM_SWEEP_INTERVAL_MS = 60_000;
export const ROOM_IDLE_TTL_MS = 5 * 60_000;
const ROOM_FLUSH_INTERVAL_MS = 5_000;

type AliveSocket = WebSocket & { isAlive?: boolean };

/**
 * Routes the custom backend endpoints that own the shared in-memory state
 * (market cache, search index, room manager). Returns `true` when it has
 * handled the request; `false` lets the caller fall through (e.g. to Next in
 * the combined dev server, or to a 404 in the standalone api server).
 */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = new URL(req.url ?? "", "http://localhost").pathname;

  if (pathname.startsWith("/api/")) {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return true;
    }
  }

  if (pathname === "/api/candles") {
    await handleCandles(req, res, marketService);
    return true;
  }
  if (pathname === "/api/search") {
    await ensureSearchIndex();
    handleSearch(req, res, searchEngine);
    return true;
  }
  if (pathname === "/api/rooms/create" && req.method === "POST") {
    handleCreateRoom(req, res, roomManager);
    return true;
  }
  if (pathname === "/api/suggestions" && req.method === "POST") {
    await handleCreateSuggestion(req, res);
    return true;
  }

  return false;
}

/**
 * Wires the collaboration WebSocket hub, its heartbeat, the idle-room sweep,
 * the periodic dirty-room flush, and graceful shutdown onto an HTTP server.
 */
export function attachRoomWss(
  server: Server,
  opts: {
    onOtherUpgrade?: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
  } = {},
): void {
  const { onOtherUpgrade } = opts;

  roomManager.hydrate(ROOM_IDLE_TTL_MS);

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD });

  wss.on("connection", (ws: AliveSocket, req: IncomingMessage) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    handleJoinRoom(ws, req, roomManager);
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "", "http://localhost").pathname;
    if (pathname === ROOM_JOIN_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (onOtherUpgrade) {
      onOtherUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const w = ws as AliveSocket;
      if (w.isAlive === false) {
        ws.terminate();
        continue;
      }
      w.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref?.();

  const roomSweep = setInterval(() => {
    roomManager.reapIdle(ROOM_IDLE_TTL_MS);
  }, ROOM_SWEEP_INTERVAL_MS);
  roomSweep.unref?.();

  const roomFlush = setInterval(() => {
    roomManager.flushDirty();
  }, ROOM_FLUSH_INTERVAL_MS);
  roomFlush.unref?.();

  // Graceful shutdown: flush rooms, close the DB, drain connections.
  let shuttingDown = false;
  const shutdown = (signal: string, code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, flushing rooms and shutting down...`);
    clearInterval(heartbeat);
    clearInterval(roomSweep);
    clearInterval(roomFlush);
    roomManager.flushDirty();
    roomStore.close();
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 5_000).unref?.();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  // An uncaught exception leaves the process in an undefined state; flush what
  // we can and exit non-zero so a process manager restarts a clean instance.
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception:", err);
    shutdown("uncaughtException", 1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection:", reason);
  });
}
