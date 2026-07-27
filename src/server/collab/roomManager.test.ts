import { describe, it, expect } from "vitest";
import { RoomManager } from "./roomManager";
import type { Room } from "./room";

// A room-like with just the fields RoomManager reads: id, its client set, and
// emptySince (null while occupied, else when it went empty — drives reaping).
const room = (
  id: string,
  opts: { clients?: number; emptySince?: number | null } = {},
) =>
  ({
    id,
    clients: new Set(Array.from({ length: opts.clients ?? 0 })),
    emptySince: opts.emptySince ?? null,
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

  it("reaps rooms empty for longer than the TTL", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("old", { clients: 0, emptySince: now - ttl - 1 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("old")).toBeUndefined();
  });

  it("keeps rooms still within the grace period", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("fresh", { clients: 0, emptySince: now - 1000 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("fresh")).toBeDefined();
  });

  it("never reaps an occupied room (emptySince null), however old", () => {
    const mgr = new RoomManager();
    mgr.addRoom(room("busy", { clients: 3, emptySince: null }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("busy")).toBeDefined();
  });
});
