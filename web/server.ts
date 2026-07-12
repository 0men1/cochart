import { createServer, type IncomingMessage } from "node:http";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { handleCreateRoom, handleJoinRoom } from "./src/server/collab/routes";
import { handleCandles, handleSearch } from "./src/server/market/routes";
import {
  ensureSearchIndex,
  marketService,
  roomManager,
  searchEngine,
} from "./src/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const ROOM_JOIN_PATH = "/api/rooms/join";

type AliveSocket = WebSocket & { isAlive?: boolean };

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main(): Promise<void> {
  await app.prepare();
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
        handleCreateRoom(res, roomManager);
        return;
      }

      await handle(req, res);
    } catch (err) {
      console.error("Request error:", err);
      if (!res.headersSent) res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

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
      // Next.js dev HMR (and any other upgrades) must reach Next's handler.
      upgradeHandler(req, socket, head);
    }
  });

  // Terminate sockets that miss a pong (replaces Go's 60s read deadline).
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

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (dev=${dev})`);
  });
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
