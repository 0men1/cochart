import { describe, it, expect, vi } from "vitest";
import { RoomManager } from "./roomManager";
import type { Client } from "./client";
import type { Room } from "./room";

const room = (id: string) => ({ id }) as unknown as Room;

// A client with just the fields RoomManager reads: its userId and a room whose
// id it belongs to (with an unregister spy so eviction can be asserted).
function client(userId: string, roomId: string) {
  const unregister = vi.fn();
  const c = { userId, room: { id: roomId, unregister } };
  return c as unknown as Client & { room: { unregister: ReturnType<typeof vi.fn> } };
}

describe("RoomManager", () => {
  it("returns undefined for an unknown room", () => {
    const mgr = new RoomManager();
    expect(mgr.getRoom("missing")).toBeUndefined();
  });

  it("stores and retrieves a room by its id", () => {
    const mgr = new RoomManager();
    const r = room("r1");
    mgr.addRoom(r);
    expect(mgr.getRoom("r1")).toBe(r);
  });

  it("removes a room", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("r1"));
    mgr.removeRoom("r1");
    expect(mgr.getRoom("r1")).toBeUndefined();
  });
});

describe("RoomManager per-user index", () => {
  it("tracks the distinct rooms a user occupies", () => {
    const mgr = new RoomManager();
    mgr.trackClient(client("u1", "rA"));
    mgr.trackClient(client("u1", "rB"));
    mgr.trackClient(client("u2", "rA"));

    expect(mgr.roomsForUser("u1")).toEqual(new Set(["rA", "rB"]));
    expect(mgr.roomsForUser("u2")).toEqual(new Set(["rA"]));
    expect(mgr.roomsForUser("nobody")).toEqual(new Set());
  });

  it("untracks a client and forgets the user once empty", () => {
    const mgr = new RoomManager();
    const a = client("u1", "rA");
    const b = client("u1", "rB");
    mgr.trackClient(a);
    mgr.trackClient(b);

    mgr.untrackClient(a);
    expect(mgr.roomsForUser("u1")).toEqual(new Set(["rB"]));

    mgr.untrackClient(b);
    expect(mgr.roomsForUser("u1")).toEqual(new Set());
  });

  it("evicts the user from every room except the one to keep", () => {
    const mgr = new RoomManager();
    const a = client("u1", "rA");
    const b = client("u1", "rB");
    const keep = client("u1", "rC");
    mgr.trackClient(a);
    mgr.trackClient(b);
    mgr.trackClient(keep);

    mgr.evictUserFromOtherRooms("u1", "rC");

    expect(a.room.unregister).toHaveBeenCalledWith(a);
    expect(b.room.unregister).toHaveBeenCalledWith(b);
    expect(keep.room.unregister).not.toHaveBeenCalled();
  });

  it("evicting an unknown user is a no-op", () => {
    const mgr = new RoomManager();
    expect(() => mgr.evictUserFromOtherRooms("ghost", "rA")).not.toThrow();
  });
});
