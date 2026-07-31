import type { IncomingMessage, ServerResponse } from "node:http";

const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? "https://cochart.app,https://www.cochart.app")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    return; // origin not allowed (or same-origin request): no CORS headers
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function clientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0].trim();
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}
