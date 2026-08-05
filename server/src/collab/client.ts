import type { WebSocket } from "ws";
import { logger } from "@cochart/protocol";
import { counters } from "../metrics";
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
      counters.msgsIn += 1;
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

  /** Returns true when the frame was actually handed to the socket. */
  send(message: string): boolean {
    if (this.conn.readyState !== this.conn.OPEN) {
      counters.sendsDropped += 1;
      return false;
    }
    this.conn.send(message);
    counters.msgsOut += 1;
    return true;
  }
}
