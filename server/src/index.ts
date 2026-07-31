import { createServer } from "node:http";
import { handleApiRequest, attachRoomWss } from "./apiHandler";
import { logger } from "@cochart/protocol";

// Standalone backend service: the custom /api routes + the collaboration
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const server = createServer(async (req, res) => {
  try {
    if (await handleApiRequest(req, res)) return;
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    logger.error("Request error:", err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  }
});

attachRoomWss(server);

server.listen(port, hostname, () => {
  logger.info(`> API ready on http://${hostname}:${port} (dev=${dev})`);
});
