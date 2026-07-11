import type { WebSocket } from "ws";
import type { Room } from "./room";

// Wraps a raw ws connection. The ping/pong heartbeat that replaces Go's read
// deadline lives at the socket level in server.ts.
export class Client {
  constructor(
    public conn: WebSocket,
    public displayName: string,
    public room: Room,
  ) { }

  start(): void {
    console.log("Starting client")
    this.conn.on("message", (data: Buffer) => {
      // Let the room apply the delta to its authoritative state and relay
      // it. Text frame + trim matches the original Go server behavior.
      console.log("Data in start funciton : " + data)
      this.room.handleMessage(data.toString().trim(), this);
    });

    const onGone = () => this.room.unregister(this);
    this.conn.on("close", onGone);
    this.conn.on("error", onGone);
  }

  send(message: string): void {
    console.log(this.displayName + " is sending: " + message)
    if (this.conn.readyState === this.conn.OPEN) {
      console.log("sending msg: " + message);
      this.conn.send(message);
    }
  }
}
