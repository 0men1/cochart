import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleCreateRoom, handleJoinRoom } from "./routes";
import { RoomManager } from "./roomManager";
import { Room } from "./room";

function fakeReq(ip: string, url = "/"): IncomingMessage {
  return {
    url,
    headers: {},
    socket: { remoteAddress: ip },
  } as unknown as IncomingMessage;
}

function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    writeHead: vi.fn((status: number) => {
      res.statusCode = status;
      return res;
    }),
    end: vi.fn((payload?: string) => {
      if (payload) res.body = JSON.parse(payload);
    }),
  };
  return res as unknown as ServerResponse & { statusCode: number; body: unknown };
}

// Minimal ws stand-in: records handlers, sends, and close calls.
function fakeWs() {
  return {
    OPEN: 1,
    readyState: 1,
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  };
}

describe("handleCreateRoom", () => {
  it("creates a room and returns its id/url", () => {
    const mgr = new RoomManager();
    const res = fakeRes();
    handleCreateRoom(fakeReq("10.0.0.1"), res, mgr);

    expect(res.statusCode).toBe(200);
    const body = res.body as { roomId: string; url: string };
    expect(body.roomId).toBeTruthy();
    expect(body.url).toBe(`/chart/room/${body.roomId}`);
    expect(mgr.getRoom(body.roomId)).toBeDefined();
  });

  it("rate-limits room creation per client (429 after the burst)", () => {
    const mgr = new RoomManager();
    // Unique IP so this test's window is independent of the shared limiter's
    // other keys. Limit is 30/min.
    const ip = "203.0.113.77";
    let last = fakeRes();
    for (let n = 0; n < 30; n++) {
      last = fakeRes();
      handleCreateRoom(fakeReq(ip), last, mgr);
    }
    expect(last.statusCode).toBe(200);

    const over = fakeRes();
    handleCreateRoom(fakeReq(ip), over, mgr);
    expect(over.statusCode).toBe(429);
  });
});

describe("handleJoinRoom", () => {
  it("registers the client and ignores a spoofed userId (no eviction)", () => {
    const mgr = new RoomManager();
    const room = new Room("room-1", mgr);
    mgr.addRoom(room);

    const ws = fakeWs();
    // A caller supplying someone else's userId + force must still just join —
    // there is no per-user cap or eviction to abuse any more.
    handleJoinRoom(
      ws as never,
      fakeReq("1.2.3.4", "/api/rooms/join?roomId=room-1&userId=victim&force=1"),
      mgr,
    );

    expect(room.clients.size).toBe(1);
    expect(ws.close).not.toHaveBeenCalled();
  });

  it("closes the socket when the room does not exist", () => {
    const mgr = new RoomManager();
    const ws = fakeWs();
    handleJoinRoom(ws as never, fakeReq("1.2.3.4", "/api/rooms/join?roomId=nope"), mgr);
    expect(ws.close).toHaveBeenCalledWith(1008, "Room not found");
  });
});
