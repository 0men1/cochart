import { describe, it, expect, vi } from "vitest";
import { Client } from "./client";
import { WS_CLOSE_REPLACED } from "./protocol";
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

// A socket for driving close(); `readyState` is settable so a test can put it
// in the already-closed state.
function fakeClosableConn(readyState = 1) {
  return {
    OPEN: 1,
    CLOSED: 3,
    readyState,
    on: vi.fn(),
    close: vi.fn(),
  };
}

describe("Client close", () => {
  const room = { unregister: vi.fn() } as unknown as Room;

  it("passes the code and reason through so the peer learns why it was dropped", () => {
    const conn = fakeClosableConn();
    const client = new Client(conn as never, "Guest", room, "u1", "#fff");

    client.close(WS_CLOSE_REPLACED, "Replaced by a newer session");
    expect(conn.close).toHaveBeenCalledWith(WS_CLOSE_REPLACED, "Replaced by a newer session");
  });

  it("is a no-op on an already-closed socket", () => {
    const conn = fakeClosableConn(3);
    const client = new Client(conn as never, "Guest", room, "u1", "#fff");

    client.close(1000);
    expect(conn.close).not.toHaveBeenCalled();
  });

  it("swallows a throw from a socket that is already closing", () => {
    const conn = fakeClosableConn();
    conn.close.mockImplementation(() => {
      throw new Error("WebSocket is not open");
    });
    const client = new Client(conn as never, "Guest", room, "u1", "#fff");

    expect(() => client.close(1000)).not.toThrow();
  });
});
