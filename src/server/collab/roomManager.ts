import type { Client } from "./client";
import type { Room } from "./room";

export class RoomManager {
	private rooms = new Map<string, Room>();
	// userId -> that user's live clients across every room. Powers the per-user
	// concurrent-room limit and force-join eviction. Rooms keep this in sync via
	// trackClient/untrackClient in their register/unregister.
	private userClients = new Map<string, Set<Client>>();

	getRoom(id: string): Room | undefined {
		return this.rooms.get(id);
	}

	addRoom(room: Room): void {
		this.rooms.set(room.id, room);
	}

	removeRoom(id: string): void {
		this.rooms.delete(id);
	}

	trackClient(client: Client): void {
		let clients = this.userClients.get(client.userId);
		if (!clients) {
			clients = new Set();
			this.userClients.set(client.userId, clients);
		}
		clients.add(client);
	}

	untrackClient(client: Client): void {
		const clients = this.userClients.get(client.userId);
		if (!clients) return;
		clients.delete(client);
		if (clients.size === 0) this.userClients.delete(client.userId);
	}

	// The distinct room ids this user currently occupies.
	roomsForUser(userId: string): Set<string> {
		const clients = this.userClients.get(userId);
		if (!clients) return new Set();
		return new Set(Array.from(clients, (c) => c.room.id));
	}

	// Disconnect the user from every room except `keepRoomId` (used when they
	// confirm a force-join). Unregistering closes the socket and untracks it.
	evictUserFromOtherRooms(userId: string, keepRoomId: string): void {
		const clients = this.userClients.get(userId);
		if (!clients) return;
		for (const client of Array.from(clients)) {
			if (client.room.id !== keepRoomId) client.room.unregister(client);
		}
	}
}
