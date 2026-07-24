import { describe, it, expect, vi } from "vitest";
import { Room } from "./room";
import type { Client } from "./client";
import type { RoomManager } from "./roomManager";
import { CollabAction } from "./protocol";

interface FakeClient {
  sent: string[];
  start: () => void;
  send: (m: string) => void;
  conn: { close: () => void };
  userId: string;
  displayName: string;
  color: string;
}

function fakeClient(id: string): FakeClient {
  const c: FakeClient = {
    sent: [],
    start: () => { },
    send: (m: string) => c.sent.push(m),
    conn: { close: () => { } },
    userId: id,
    displayName: `user-${id}`,
    color: "#000000",
  };
  return c;
}

// Room touches removeRoom + the per-user client index on the manager.
function fakeManager() {
  return {
    removeRoom: vi.fn(),
    trackClient: vi.fn(),
    untrackClient: vi.fn(),
  } as unknown as RoomManager;
}

function newRoom(manager = fakeManager()): Room {
  return new Room("room-1", manager);
}

const asClient = (c: FakeClient) => c as unknown as Client;

// The last message a client received whose type === wanted, parsed.
function lastMessageOfType(c: FakeClient, type: string): any {
  const raw = [...c.sent].reverse().find((m) => {
    try {
      return JSON.parse(m).type === type;
    } catch {
      return false;
    }
  });
  return raw ? JSON.parse(raw) : undefined;
}

describe("Room seeding", () => {
  it("seeds on INIT_ROOM and ignores a later INIT_ROOM (first seed wins)", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));

    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "BTC-USD", timeframe: "1H", drawings: [] },
      }),
      asClient(a),
    );
    // A late, conflicting seed must not overwrite the truth.
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "ETH-USD", timeframe: "1D", drawings: [] },
      }),
      asClient(a),
    );

    const b = fakeClient("b");
    room.register(asClient(b));
    const snap = lastMessageOfType(b, CollabAction.SNAPSHOT);
    expect(snap.payload.product).toBe("BTC-USD");
    expect(snap.payload.timeframe).toBe("1H");
  });

  it("sends a snapshot to a client that joins after seeding", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: {
          product: "BTC-USD",
          timeframe: "1H",
          drawings: [{ id: "d1", kind: "trendline" }],
        },
      }),
      asClient(a),
    );

    const b = fakeClient("b");
    room.register(asClient(b));
    const snap = lastMessageOfType(b, CollabAction.SNAPSHOT);
    expect(snap.payload.drawings).toEqual([{ id: "d1", kind: "trendline" }]);
  });

  it("does not send a snapshot to the first client (nothing seeded yet)", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    expect(lastMessageOfType(a, CollabAction.SNAPSHOT)).toBeUndefined();
  });
});

describe("Room drawing state", () => {
  function seededRoom() {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "BTC-USD", timeframe: "1H", drawings: [] },
      }),
      asClient(a),
    );
    return { room, a };
  }

  // Read current drawings by joining a fresh client and reading its snapshot.
  function drawingsSnapshot(room: Room): any[] {
    const probe = fakeClient(`probe-${Math.random()}`);
    room.register(probe as unknown as Client);
    return lastMessageOfType(probe, CollabAction.SNAPSHOT).payload.drawings;
  }

  it("adds and modifies a drawing by id", () => {
    const { room, a } = seededRoom();
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.ADD_DRAWING,
        payload: { drawing: { id: "d1", color: "red" } },
      }),
      asClient(a),
    );
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.MODIFY_DRAWING,
        payload: { drawing: { id: "d1", color: "blue" } },
      }),
      asClient(a),
    );
    expect(drawingsSnapshot(room)).toEqual([{ id: "d1", color: "blue" }]);
  });

  it("deletes a drawing by id", () => {
    const { room, a } = seededRoom();
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.ADD_DRAWING,
        payload: { drawing: { id: "d1" } },
      }),
      asClient(a),
    );
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.DELETE_DRAWING,
        payload: { drawingId: "d1" },
      }),
      asClient(a),
    );
    expect(drawingsSnapshot(room)).toEqual([]);
  });

  it("updates chart selection on SELECT_CHART", () => {
    const { room, a } = seededRoom();
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.SELECT_CHART,
        payload: { product: "SOL-USD", timeframe: "5m" },
      }),
      asClient(a),
    );
    const probe = fakeClient("probe");
    room.register(asClient(probe));
    const snap = lastMessageOfType(probe, CollabAction.SNAPSHOT);
    expect(snap.payload.product).toBe("SOL-USD");
    expect(snap.payload.timeframe).toBe("5m");
  });
});

describe("Room indicator state", () => {
  function seededRoom() {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "BTC-USD", timeframe: "1H", drawings: [], indicators: [] },
      }),
      asClient(a),
    );
    return { room, a };
  }

  // Read current indicators by joining a fresh client and reading its snapshot.
  function indicatorsSnapshot(room: Room): any[] {
    const probe = fakeClient(`probe-${Math.random()}`);
    room.register(probe as unknown as Client);
    return lastMessageOfType(probe, CollabAction.SNAPSHOT).payload.indicators;
  }

  it("adds and modifies an indicator by id (upsert)", () => {
    const { room, a } = seededRoom();
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.ADD_INDICATOR,
        payload: { indicator: { id: "i1", type: "SMA", params: { period: 20 } } },
      }),
      asClient(a),
    );
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.MODIFY_INDICATOR,
        payload: { indicator: { id: "i1", type: "SMA", params: { period: 50 } } },
      }),
      asClient(a),
    );
    expect(indicatorsSnapshot(room)).toEqual([{ id: "i1", type: "SMA", params: { period: 50 } }]);
  });

  it("removes an indicator by id", () => {
    const { room, a } = seededRoom();
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.ADD_INDICATOR,
        payload: { indicator: { id: "i1", type: "VOLUME" } },
      }),
      asClient(a),
    );
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.REMOVE_INDICATOR,
        payload: { indicatorId: "i1" },
      }),
      asClient(a),
    );
    expect(indicatorsSnapshot(room)).toEqual([]);
  });

  it("seeds indicators from INIT_ROOM and includes them in a joiner's snapshot", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: {
          product: "BTC-USD",
          timeframe: "1H",
          drawings: [],
          indicators: [{ id: "i1", type: "RSI", params: { period: 14 } }],
        },
      }),
      asClient(a),
    );

    const b = fakeClient("b");
    room.register(asClient(b));
    const snap = lastMessageOfType(b, CollabAction.SNAPSHOT);
    expect(snap.payload.indicators).toEqual([{ id: "i1", type: "RSI", params: { period: 14 } }]);
  });
});

describe("Room broadcasting", () => {
  it("relays a delta to other clients but not the sender", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    a.sent.length = 0;
    b.sent.length = 0;

    const raw = JSON.stringify({
      type: CollabAction.SELECT_CHART,
      payload: { product: "BTC-USD", timeframe: "1H" },
    });
    room.handleMessage(raw, asClient(a));

    expect(a.sent).not.toContain(raw);
    expect(b.sent).toContain(raw);
  });

  it("relays a CURSOR to peers but keeps it out of the snapshot", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    // Seed so a late joiner's snapshot is populated with drawings only.
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "BTC-USD", timeframe: "1H", drawings: [] },
      }),
      asClient(a),
    );
    a.sent.length = 0;
    b.sent.length = 0;

    const raw = JSON.stringify({
      type: CollabAction.CURSOR,
      payload: { userId: "a", time: 1700000000, price: 42000 },
    });
    room.handleMessage(raw, asClient(a));

    // Peer receives it; sender does not.
    expect(b.sent).toContain(raw);
    expect(a.sent).not.toContain(raw);

    // Ephemeral: a fresh joiner's snapshot never carries cursor data.
    const probe = fakeClient("probe");
    room.register(asClient(probe));
    const snap = lastMessageOfType(probe, CollabAction.SNAPSHOT);
    expect(snap.payload.drawings).toEqual([]);
  });

  it("relays a DRAWING_DRAG to peers but keeps it out of the snapshot", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    // Seed so a late joiner's snapshot has content to compare against.
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "BTC-USD", timeframe: "1H", drawings: [{ id: "d1" }] },
      }),
      asClient(a),
    );
    a.sent.length = 0;
    b.sent.length = 0;

    const raw = JSON.stringify({
      type: CollabAction.DRAWING_DRAG,
      payload: {
        userId: "a",
        drawingId: "d1",
        points: [{ time: 1, price: 2 }, { time: 3, price: 4 }],
      },
    });
    room.handleMessage(raw, asClient(a));

    // Peer receives it; sender does not.
    expect(b.sent).toContain(raw);
    expect(a.sent).not.toContain(raw);

    // Ephemeral: a fresh joiner's snapshot still shows the pre-drag drawing,
    // never the in-progress drag points.
    const probe = fakeClient("probe");
    room.register(asClient(probe));
    const snap = lastMessageOfType(probe, CollabAction.SNAPSHOT);
    expect(snap.payload.drawings).toEqual([{ id: "d1" }]);
  });

  it("relays malformed JSON to others without throwing", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    b.sent.length = 0;

    expect(() => room.handleMessage("not json{", asClient(a))).not.toThrow();
    expect(b.sent).toContain("not json{");
  });

  it("broadcasts a presence roster to everyone on register", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    const presence = lastMessageOfType(a, CollabAction.PRESENCE);
    expect(presence.payload.count).toBe(1);
    expect(presence.payload.users[0].userId).toBe("a");
  });
});

describe("Room presence updates", () => {
  it("updates the sender's name and color, then broadcasts to everyone", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    a.sent.length = 0;
    b.sent.length = 0;

    room.handleMessage(
      JSON.stringify({
        type: CollabAction.UPDATE_PRESENCE,
        payload: { displayName: "Renamed", color: "#123456" },
      }),
      asClient(a),
    );

    // Both the sender and the peer receive the refreshed roster.
    for (const c of [a, b]) {
      const presence = lastMessageOfType(c, CollabAction.PRESENCE);
      const me = presence.payload.users.find((u: any) => u.userId === "a");
      expect(me.displayName).toBe("Renamed");
      expect(me.color).toBe("#123456");
    }
  });

  it("ignores an empty display name and keeps the previous value", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));

    room.handleMessage(
      JSON.stringify({
        type: CollabAction.UPDATE_PRESENCE,
        payload: { displayName: "   ", color: "#abcdef" },
      }),
      asClient(a),
    );

    const presence = lastMessageOfType(a, CollabAction.PRESENCE);
    const me = presence.payload.users.find((u: any) => u.userId === "a");
    expect(me.displayName).toBe("user-a");
    expect(me.color).toBe("#abcdef");
  });

  it("does not relay the raw UPDATE_PRESENCE delta to peers", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    b.sent.length = 0;

    const raw = JSON.stringify({
      type: CollabAction.UPDATE_PRESENCE,
      payload: { displayName: "Renamed" },
    });
    room.handleMessage(raw, asClient(a));

    expect(b.sent).not.toContain(raw);
  });
});

describe("Room chat", () => {
  // Read current chat history by joining a fresh client and reading its snapshot.
  function messagesSnapshot(room: Room): any[] {
    const probe = fakeClient(`probe-${Math.random()}`);
    room.register(probe as unknown as Client);
    return lastMessageOfType(probe, CollabAction.SNAPSHOT).payload.messages;
  }

  it("broadcasts a chat message to everyone including the sender", () => {
    const room = newRoom();
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    a.sent.length = 0;
    b.sent.length = 0;

    room.handleMessage(
      JSON.stringify({ type: CollabAction.CHAT, payload: { text: "hello" } }),
      asClient(a),
    );

    for (const c of [a, b]) {
      const chat = lastMessageOfType(c, CollabAction.CHAT);
      expect(chat.payload.message.text).toBe("hello");
    }
  });

  it("stamps identity from the sender and ignores spoofed identity in the payload", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));

    room.handleMessage(
      JSON.stringify({
        type: CollabAction.CHAT,
        payload: {
          text: "hi",
          userId: "victim",
          displayName: "Impostor",
          color: "#ffffff",
        },
      }),
      asClient(a),
    );

    const chat = lastMessageOfType(a, CollabAction.CHAT);
    expect(chat.payload.message.userId).toBe("a");
    expect(chat.payload.message.displayName).toBe("user-a");
    expect(chat.payload.message.color).toBe("#000000");
    expect(typeof chat.payload.message.id).toBe("string");
  });

  it("drops empty/whitespace-only messages and truncates long ones", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));

    room.handleMessage(
      JSON.stringify({ type: CollabAction.CHAT, payload: { text: "   " } }),
      asClient(a),
    );
    expect(lastMessageOfType(a, CollabAction.CHAT)).toBeUndefined();

    const long = "x".repeat(600);
    room.handleMessage(
      JSON.stringify({ type: CollabAction.CHAT, payload: { text: long } }),
      asClient(a),
    );
    expect(lastMessageOfType(a, CollabAction.CHAT).payload.message.text).toHaveLength(500);
  });

  it("caps stored history and replays it to a late joiner via snapshot", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    // Seed so a snapshot is sent to joiners.
    room.handleMessage(
      JSON.stringify({
        type: CollabAction.INIT_ROOM,
        payload: { product: "BTC-USD", timeframe: "1H", drawings: [] },
      }),
      asClient(a),
    );

    for (let i = 0; i < 250; i++) {
      room.handleMessage(
        JSON.stringify({ type: CollabAction.CHAT, payload: { text: `m${i}` } }),
        asClient(a),
      );
    }

    const history = messagesSnapshot(room);
    expect(history).toHaveLength(200);
    // Oldest were dropped; the newest is retained.
    expect(history[history.length - 1].text).toBe("m249");
    expect(history[0].text).toBe("m50");
  });

  it("does not seed the room's chart truth on chat alone", () => {
    const room = newRoom();
    const a = fakeClient("a");
    room.register(asClient(a));
    room.handleMessage(
      JSON.stringify({ type: CollabAction.CHAT, payload: { text: "hi" } }),
      asClient(a),
    );

    // A later joiner gets no snapshot because the room was never seeded.
    const b = fakeClient("b");
    room.register(asClient(b));
    expect(lastMessageOfType(b, CollabAction.SNAPSHOT)).toBeUndefined();
  });
});

describe("Room lifecycle", () => {
  it("removes itself from the manager when the last client leaves", () => {
    const manager = fakeManager();
    const room = newRoom(manager);
    const a = fakeClient("a");
    room.register(asClient(a));

    room.unregister(asClient(a));
    expect(manager.removeRoom).toHaveBeenCalledWith("room-1");
  });

  it("keeps the room and rebroadcasts presence when others remain", () => {
    const manager = fakeManager();
    const room = newRoom(manager);
    const a = fakeClient("a");
    const b = fakeClient("b");
    room.register(asClient(a));
    room.register(asClient(b));
    b.sent.length = 0;

    room.unregister(asClient(a));
    expect(manager.removeRoom).not.toHaveBeenCalled();
    expect(lastMessageOfType(b, CollabAction.PRESENCE).payload.count).toBe(1);
  });
});
