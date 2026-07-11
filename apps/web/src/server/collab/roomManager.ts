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
}
