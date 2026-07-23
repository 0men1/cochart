import type { IncomingMessage, ServerResponse } from "node:http";

// Best-effort client IP: honour the leftmost x-forwarded-for hop (the original
// client behind a reverse proxy), falling back to the socket address. Shared by
// every rate-limited endpoint so quotas key off the same identity.
export function clientIp(req: IncomingMessage): string {
	const forwarded = req.headers["x-forwarded-for"];
	if (typeof forwarded === "string" && forwarded.length > 0) {
		return forwarded.split(",")[0].trim();
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
