import { Room } from "./room";
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

  reapIdle(maxAgeMs: number, now: number = Date.now()): void {
    for (const [id, room] of this.rooms) {
      if (room.emptySince !== null && now - room.emptySince > maxAgeMs) {
        this.rooms.delete(id);
        this.store.delete(id);
      }
    }
  }

  // Persist rooms whose state changed since the last flush
  flushDirty(): void {
    for (const room of this.rooms.values()) {
      if (!room.dirty) continue;
      this.store.save(room.serialize());
      room.dirty = false;
    }
  }

  // Rebuild rooms from the store on boot (after a restart/deploy)
  hydrate(graceMs: number, now: number = Date.now()): void {
    for (const persisted of this.store.loadAll()) {
      this.addRoom(Room.fromPersisted(persisted));
    }
    this.reapIdle(graceMs, now);
  }
}
