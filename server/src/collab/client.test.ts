import { describe, it, expect, vi } from "vitest";
import { Client } from "./client";
import type { Room } from "./room";

// Capture the socket's event handlers so we can drive "message" ourselves.
function fakeConn() {
  const handlers: Record<string, (arg: Buffer) => void> = {};
  return {
    on: vi.fn((event: string, cb: (arg: Buffer) => void) => {
      handlers[event] = cb;
    }),
    emitMessage: (raw: string) => handlers["message"]?.(Buffer.from(raw)),
  };
}

describe("Client message handling", () => {
  it("swallows an error thrown by room.handleMessage instead of crashing", () => {
    const conn = fakeConn();
    // A room whose handler throws on a bad frame (the real crash vector).
    const room = {
      handleMessage: vi.fn(() => {
        throw new TypeError("(intermediate value).map is not a function");
      }),
    } as unknown as Room;

    const client = new Client(conn as never, "Guest", room, "u1", "#fff");
    client.start();

    // Delivering the frame must NOT propagate the throw out of the listener.
    expect(() => conn.emitMessage('{"type":"INIT_ROOM","payload":{"drawings":"x"}}')).not.toThrow();
    expect(room.handleMessage).toHaveBeenCalledOnce();
  });

  it("forwards a well-formed frame to the room verbatim (trimmed)", () => {
    const conn = fakeConn();
    const room = { handleMessage: vi.fn() } as unknown as Room;
    const client = new Client(conn as never, "Guest", room, "u1", "#fff");
    client.start();

    conn.emitMessage('  {"type":"CURSOR"}  ');
    expect(room.handleMessage).toHaveBeenCalledWith('{"type":"CURSOR"}', client);
  });
});
