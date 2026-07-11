import type { Client } from "./client";
import type { RoomManager } from "./roomManager";

export class Room {
  clients = new Set<Client>();

  constructor(
    public id: string,
    private manager: RoomManager,
  ) { }

  register(client: Client): void {
    this.clients.add(client);
    client.start();

    const activeUsers = this.clients.size;
    const action = JSON.stringify({
      type: "USER_JOINED",
      payload: { displayName: client.displayName, numActiveUsers: activeUsers },
    });

    console.log(
      `User joined: ${client.displayName} (Room: ${this.id}, Total: ${activeUsers})`,
    );

    this.broadcastToOthers(action, client);
  }

  unregister(client: Client): void {
    if (!this.clients.has(client)) return;
    this.clients.delete(client);

    try {
      client.conn.close();
    } catch {
      // already closed
    }

    const action = JSON.stringify({
      type: "USER_LEFT",
      payload: { displayName: client.displayName },
    });
    this.broadcastToAll(action);

    if (this.clients.size === 0) {
      console.log(`Room ${this.id} empty, cleaning up`);
      this.manager.removeRoom(this.id);
    }
  }

  broadcastToAll(message: string): void {
    for (const client of this.clients) {
      client.send(message);
    }
  }

  broadcastToOthers(message: string, sender: Client): void {
    for (const client of this.clients) {
      if (client === sender) continue;
      client.send(message);
    }
  }
}
