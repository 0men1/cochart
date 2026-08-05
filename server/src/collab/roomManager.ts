import { Room } from "./room";
import { counters } from "../metrics";
import type { SqliteRoomStore } from "./roomStore";

export class RoomManager {
  private rooms = new Map<string, Room>();

  // Rooms are persisted to the store so they survive a server restart.
  constructor(private store: SqliteRoomStore) { }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  addRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  createRoom(id: string): Room {
    const room = new Room(id);
    this.addRoom(room);
    return room;
  }

  removeRoom(id: string): void {
    if (this.rooms.delete(id)) this.store.delete(id);
  }

  get size(): number {
    return this.rooms.size;
  }

  get clientCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.clients.size;
    return total;
  }

  reapIdle(maxAgeMs: number, now: number = Date.now()): void {
    for (const [id, room] of this.rooms) {
      if (room.emptySince !== null && now - room.emptySince > maxAgeMs) {
        this.rooms.delete(id);
        this.store.delete(id);
      }
    }
  }

  // Persist rooms whose state changed since the last flush.
  flushDirty(): void {
    const startedAt = performance.now();
    let written = 0;
    for (const room of this.rooms.values()) {
      if (!room.dirty) continue;
      this.store.save(room.serialize());
      room.dirty = false;
      written += 1;
    }
    const elapsed = performance.now() - startedAt;
    counters.flushes += 1;
    counters.flushedRooms += written;
    counters.lastFlushMs = Math.round(elapsed * 1000) / 1000;
    if (elapsed > counters.maxFlushMs) counters.maxFlushMs = counters.lastFlushMs;
  }

  // Rebuild rooms from the store on boot (after a restart/deploy)
  hydrate(graceMs: number, now: number = Date.now()): void {
    for (const persisted of this.store.loadAll()) {
      this.addRoom(Room.fromPersisted(persisted));
    }
    this.reapIdle(graceMs, now);
  }
}
