import type { WebSocket } from "ws";
import { logger } from "../../lib/logger";
import { createRateLimiter } from "../feedback/rateLimit";
import type { Room } from "./room";

const MSG_RATE_LIMIT = 480;
const MSG_RATE_WINDOW_MS = 10_000;
const MSG_VIOLATION_LIMIT = 100;

export class Client {
  // Own limiter per connection, so one noisy socket can't starve the room.
  private readonly limiter = createRateLimiter({
    limit: MSG_RATE_LIMIT,
    windowMs: MSG_RATE_WINDOW_MS,
  });
  private violations = 0;

  constructor(
    public conn: WebSocket,
    public displayName: string,
    public room: Room,
    public userId: string,
    public color: string,
  ) { }

  start(): void {
    this.conn.on("message", (data: Buffer) => {
      // Drop frames over the per-connection rate; disconnect a sustained flood.
      if (!this.limiter.check("msg")) {
        if (++this.violations >= MSG_VIOLATION_LIMIT) {
          logger.warn(`Flooding client disconnected (Room: ${this.room.id}, User: ${this.userId})`);
          try {
            this.conn.close(1008, "Rate limit exceeded");
          } catch {
            // already closed
          }
        }
        return;
      }
      try {
        this.room.handleMessage(data.toString().trim(), this);
      } catch (err) {
        logger.error("Dropped malformed WS message:", err);
      }
    });

    const onGone = () => this.room.unregister(this);
    this.conn.on("close", onGone);
    this.conn.on("error", onGone);
  }

  send(message: string): void {
    if (this.conn.readyState === this.conn.OPEN) {
      this.conn.send(message);
    }
  }
}
