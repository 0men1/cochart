import { describe, it, expect } from "vitest";
import { RoomManager } from "./roomManager";
import type { Room } from "./room";
import { SqliteRoomStore, type PersistedRoom } from "./roomStore";

// A room-like with just the fields RoomManager reads: id, its client set,
// emptySince (drives reaping), plus dirty + serialize() for flush tests.
const room = (
  id: string,
  opts: { clients?: number; emptySince?: number | null; dirty?: boolean } = {},
) =>
  ({
    id,
    clients: new Set(Array.from({ length: opts.clients ?? 0 })),
    emptySince: opts.emptySince ?? null,
    dirty: opts.dirty ?? false,
    serialize: (): PersistedRoom => ({
      id,
      emptySince: opts.emptySince ?? null,
      state: { seeded: true, chart: null, drawings: [], indicators: [], messages: [] },
    }),
  }) as unknown as Room;

const persisted = (id: string, emptySince: number | null): PersistedRoom => ({
  id,
  emptySince,
  state: { seeded: true, chart: null, drawings: [{ id: "d1" }], indicators: [], messages: [] },
});

// Every manager gets its own throwaway in-memory store.
const store = () => new SqliteRoomStore(":memory:");

describe("RoomManager", () => {
  it("returns undefined for an unknown room", () => {
    const mgr = new RoomManager(store());
    expect(mgr.getRoom("missing")).toBeUndefined();
  });

  it("stores and retrieves a room by its id", () => {
    const mgr = new RoomManager(store());
    const r = room("r1");
    mgr.addRoom(r);
    expect(mgr.getRoom("r1")).toBe(r);
    expect(mgr.size).toBe(1);
  });

  it("removes a room", () => {
    const mgr = new RoomManager(store());
    mgr.addRoom(room("r1"));
    mgr.removeRoom("r1");
    expect(mgr.getRoom("r1")).toBeUndefined();
  });
});

describe("RoomManager.reapIdle", () => {
  const now = 1_000_000;
  const ttl = 5 * 60_000;

  it("reaps rooms empty for longer than the TTL", () => {
    const mgr = new RoomManager(store());
    mgr.addRoom(room("old", { clients: 0, emptySince: now - ttl - 1 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("old")).toBeUndefined();
  });

  it("keeps rooms still within the grace period", () => {
    const mgr = new RoomManager(store());
    mgr.addRoom(room("fresh", { clients: 0, emptySince: now - 1000 }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("fresh")).toBeDefined();
  });

  it("never reaps an occupied room (emptySince null), however old", () => {
    const mgr = new RoomManager(store());
    mgr.addRoom(room("busy", { clients: 3, emptySince: null }));
    mgr.reapIdle(ttl, now);
    expect(mgr.getRoom("busy")).toBeDefined();
  });
});

describe("RoomManager persistence", () => {
  const now = 1_000_000;
  const ttl = 5 * 60_000;

  it("flushDirty persists only dirty rooms and clears their flag", () => {
    const s = store();
    const mgr = new RoomManager(s);
    const dirty = room("dirty", { dirty: true });
    mgr.addRoom(dirty);
    mgr.addRoom(room("clean", { dirty: false }));

    mgr.flushDirty();

    expect(s.load("dirty")).toBeDefined();
    expect(s.load("clean")).toBeUndefined();
    expect(dirty.dirty).toBe(false);
  });

  it("removeRoom deletes the room's row from the store", () => {
    const s = store();
    const mgr = new RoomManager(s);
    s.save(persisted("r1", null));
    mgr.addRoom(room("r1"));
    mgr.removeRoom("r1");
    expect(s.load("r1")).toBeUndefined();
  });

  it("reapIdle deletes reaped rooms from the store", () => {
    const s = store();
    const mgr = new RoomManager(s);
    s.save(persisted("old", now - ttl - 1));
    mgr.addRoom(room("old", { emptySince: now - ttl - 1 }));
    mgr.reapIdle(ttl, now);
    expect(s.load("old")).toBeUndefined();
  });

  it("hydrate restores persisted rooms and drops ones past the grace window", () => {
    const s = store();
    s.save(persisted("fresh", now - 1000));
    s.save(persisted("expired", now - ttl - 1));
    const mgr = new RoomManager(s);

    mgr.hydrate(ttl, now);

    expect(mgr.getRoom("fresh")).toBeDefined();
    expect(mgr.getRoom("expired")).toBeUndefined();
    expect(s.load("expired")).toBeUndefined();
  });
});
