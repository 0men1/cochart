import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleCreateRoom, handleJoinRoom } from "./routes";
import { RoomManager } from "./roomManager";
import { Room } from "./room";
import { SqliteRoomStore } from "./roomStore";

const newManager = () => new RoomManager(new SqliteRoomStore(":memory:"));

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
    const mgr = newManager();
    const res = fakeRes();
    handleCreateRoom(fakeReq("10.0.0.1"), res, mgr);

    expect(res.statusCode).toBe(200);
    const body = res.body as { roomId: string; url: string };
    expect(body.roomId).toBeTruthy();
    expect(body.url).toBe(`/chart/room?id=${body.roomId}`);
    expect(mgr.getRoom(body.roomId)).toBeDefined();
  });

  it("rate-limits room creation per client (429 after the burst)", () => {
    const mgr = newManager();
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

function join(mgr: RoomManager, query: string) {
  const ws = fakeWs();
  handleJoinRoom(ws as never, fakeReq("1.2.3.4", `/api/rooms/join?${query}`), mgr);
  return ws;
}

describe("handleJoinRoom", () => {
  it("honours the userId the client asks for when it is free", () => {
    const mgr = newManager();
    const room = new Room("room-1");
    mgr.addRoom(room);

    const ws = join(mgr, "roomId=room-1&userId=mine");

    expect(room.clients.size).toBe(1);
    expect(room.clients.get("mine")).toBeDefined();
    expect(ws.close).not.toHaveBeenCalled();
  });

  it("mints an id when the client supplies none", () => {
    const mgr = newManager();
    const room = new Room("room-1");
    mgr.addRoom(room);

    join(mgr, "roomId=room-1");

    expect(room.clients.size).toBe(1);
    expect([...room.clients.keys()][0]).toBeTruthy();
  });

  it("caps an oversized userId supplied on the join URL", () => {
    const mgr = newManager();
    const room = new Room("room-1");
    mgr.addRoom(room);

    join(mgr, `roomId=room-1&userId=${"u".repeat(500)}`);

    const id = [...room.clients.keys()][0];
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it("caps an oversized displayName supplied on the join URL", () => {
    const mgr = newManager();
    const room = new Room("room-1");
    mgr.addRoom(room);

    join(mgr, `roomId=room-1&displayName=${"A".repeat(5000)}`);

    const client = [...room.clients.values()][0];
    expect(client.displayName.length).toBe(32);
  });

  it("closes the socket when the room does not exist", () => {
    const mgr = newManager();
    const ws = fakeWs();
    handleJoinRoom(ws as never, fakeReq("1.2.3.4", "/api/rooms/join?roomId=nope"), mgr);
    expect(ws.close).toHaveBeenCalledWith(1008, "Room not found");
  });
});
