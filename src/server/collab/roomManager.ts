import type { Room } from "./room";

export class RoomManager {
  private rooms = new Map<string, Room>();

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  addRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  removeRoom(id: string): void {
    this.rooms.delete(id);
  }

  get size(): number {
    return this.rooms.size;
  }

  reapIdle(maxAgeMs: number, now: number = Date.now()): void {
    for (const [id, room] of this.rooms) {
      if (room.clients.size === 0 && now - room.createdAt > maxAgeMs) {
        this.rooms.delete(id);
      }
    }
  }
}
