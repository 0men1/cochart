import { describe, it, expect } from "vitest";
import { SqliteRoomStore, type PersistedRoom } from "./roomStore";

const sampleRoom = (id: string, emptySince: number | null = null): PersistedRoom => ({
  id,
  emptySince,
  state: {
    seeded: true,
    chart: { product: "BTC-USD", timeframe: "1H" },
    drawings: [{ id: "d1", kind: "trendline" }],
    indicators: [{ id: "i1", type: "SMA" }],
    messages: [
      {
        id: "m1",
        userId: "u1",
        displayName: "Alice",
        color: "#fff",
        text: "hi",
        timestamp: 123,
      },
    ],
  },
});

// A fresh in-memory store per test — no files, no cross-test state.
const store = () => new SqliteRoomStore(":memory:");

describe("SqliteRoomStore", () => {
  it("round-trips a room's full state through save/load", () => {
    const s = store();
    const room = sampleRoom("room-1", 456);
    s.save(room);
    expect(s.load("room-1")).toEqual(room);
  });

  it("returns undefined for an unknown room", () => {
    expect(store().load("missing")).toBeUndefined();
  });

  it("loadAll returns every saved room", () => {
    const s = store();
    s.save(sampleRoom("a"));
    s.save(sampleRoom("b"));
    expect(s.loadAll().map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("save upserts an existing room rather than duplicating it", () => {
    const s = store();
    s.save(sampleRoom("room-1"));
    const updated = sampleRoom("room-1");
    updated.state.messages[0].text = "updated";
    s.save(updated);
    expect(s.loadAll()).toHaveLength(1);
    expect(s.load("room-1")?.state.messages[0].text).toBe("updated");
  });

  it("delete removes a room", () => {
    const s = store();
    s.save(sampleRoom("room-1"));
    s.delete("room-1");
    expect(s.load("room-1")).toBeUndefined();
  });

  it("preserves a null emptySince (occupied room)", () => {
    const s = store();
    s.save(sampleRoom("room-1", null));
    expect(s.load("room-1")?.emptySince).toBeNull();
  });
});
