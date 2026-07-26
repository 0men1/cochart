import { describe, it, expect } from "vitest";
import { RoomManager } from "./roomManager";
import type { Room } from "./room";

// A room-like with just the fields RoomManager reads: id, its client set (for
// emptiness), and createdAt (for reaping).
const room = (id: string, opts: { clients?: number; createdAt?: number } = {}) =>
  ({
    id,
    clients: new Set(Array.from({ length: opts.clients ?? 0 })),
    createdAt: opts.createdAt ?? Date.now(),
  }) as unknown as Room;

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
    expect(mgr.size).toBe(1);
  });

  it("removes a room", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("r1"));
    mgr.removeRoom("r1");
    expect(mgr.getRoom("r1")).toBeUndefined();
  });
});

describe("RoomManager.reapIdle", () => {
  const now = 1_000_000;
  const ttl = 5 * 60_000;

  it("reaps empty rooms created before the TTL", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("old", { clients: 0, createdAt: now - ttl - 1 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("old")).toBeUndefined();
  });

  it("keeps empty rooms still within the grace period", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("fresh", { clients: 0, createdAt: now - 1000 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("fresh")).toBeDefined();
  });

  it("never reaps a room that still has clients, however old", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("busy", { clients: 3, createdAt: now - ttl * 10 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("busy")).toBeDefined();
  });
});
