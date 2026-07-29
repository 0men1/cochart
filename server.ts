import { createServer, type IncomingMessage } from "node:http";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { handleCreateRoom, handleJoinRoom } from "./src/server/collab/routes";
import { handleCandles, handleSearch } from "./src/server/market/routes";
import { handleCreateSuggestion } from "./src/server/feedback/routes";
import {
  ensureSearchIndex,
  marketService,
  roomManager,
  roomStore,
  searchEngine,
} from "./src/server";
import { logger } from "./src/lib/logger";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const ROOM_JOIN_PATH = "/api/rooms/join";
const MAX_WS_PAYLOAD = 256 * 1024;
const ROOM_SWEEP_INTERVAL_MS = 60_000;
const ROOM_IDLE_TTL_MS = 5 * 60_000;
const ROOM_FLUSH_INTERVAL_MS = 5_000;

type AliveSocket = WebSocket & { isAlive?: boolean };

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main(): Promise<void> {
  await app.prepare();
  roomManager.hydrate(ROOM_IDLE_TTL_MS);
  const upgradeHandler = app.getUpgradeHandler();

  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "", "http://localhost").pathname;

      // Custom backend routes own the shared in-memory state (market cache,
      // search index, room manager). Everything else falls through to Next.
      if (pathname === "/api/candles") {
        await handleCandles(req, res, marketService);
        return;
      }
      if (pathname === "/api/search") {
        await ensureSearchIndex();
        handleSearch(req, res, searchEngine);
        return;
      }
      if (pathname === "/api/rooms/create" && req.method === "POST") {
        handleCreateRoom(req, res, roomManager);
        return;
      }
      if (pathname === "/api/suggestions" && req.method === "POST") {
        await handleCreateSuggestion(req, res);
        return;
      }

      await handle(req, res);
    } catch (err) {
      logger.error("Request error:", err);
      if (!res.headersSent) res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

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
    } else {
      upgradeHandler(req, socket, head);
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

  server.listen(port, hostname, () => {
    logger.info(`> Ready on http://${hostname}:${port} (dev=${dev})`);
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, flushing rooms and shutting down...`);
    clearInterval(heartbeat);
    clearInterval(roomSweep);
    clearInterval(roomFlush);
    roomManager.flushDirty();
    roomStore.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref?.();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

main().catch((err) => {
  logger.error("Fatal server error:", err);
  process.exit(1);
});
