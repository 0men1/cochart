import type { WebSocket } from "ws";
import { logger } from "@cochart/protocol";
import type { Room } from "./room";

export class Client {
  constructor(
    public conn: WebSocket,
    public displayName: string,
    public room: Room,
    public userId: string,
    public color: string,
  ) { }

  start(): void {
    this.conn.on("message", (data: Buffer) => {
      try {
        this.room.handleMessage(data.toString().trim(), this);
      } catch (err) {
        logger.error("Dropped malformed WS message:", err);
      }
    });

    const onGone = () => {
      this.room.unregister(this);
    };
    this.conn.on("close", onGone);
    this.conn.on("error", onGone);
  }

  close(code?: number, reason?: string): void {
    if (this.conn.readyState === this.conn.CLOSED) return;
    try {
      this.conn.close(code, reason);
    } catch {
      // already closing
    }
  }

  send(message: string): void {
    if (this.conn.readyState === this.conn.OPEN) {
      this.conn.send(message);
    }
  }
}
