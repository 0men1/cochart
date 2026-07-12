import { describe, it, expect } from "vitest";
import { RoomManager } from "./roomManager";
import type { Room } from "./room";

const room = (id: string) => ({ id }) as unknown as Room;

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
