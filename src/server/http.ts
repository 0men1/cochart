import type { IncomingMessage, ServerResponse } from "node:http";

const TRUST_PROXY = process.env.TRUST_PROXY === "1";

// Origins allowed to open a collaboration WebSocket
function parseOriginList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
}

const ALLOWED_WS_ORIGINS = parseOriginList(process.env.ALLOWED_WS_ORIGINS);
const ALLOWED_DEV_ORIGINS = parseOriginList(process.env.ALLOWED_DEV_ORIGINS);

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

// Guards the WS upgrade against cross-site socket hijacking
export function isAllowedWsOrigin(
  origin: string | undefined,
  opts: { dev: boolean },
): boolean {
  if (!origin) return true;
  if (opts.dev && (isLoopbackOrigin(origin) || ALLOWED_DEV_ORIGINS.has(origin))) {
    return true;
  }
  return ALLOWED_WS_ORIGINS.has(origin);
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
