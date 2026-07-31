import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type {
  ChartSelection,
  ChatMessage,
  Drawing,
  Indicator,
} from "./protocol";

// The array-shaped, JSON-serializable form of a room's authoritative state
export interface SerializedRoomState {
  seeded: boolean;
  chart: ChartSelection | null;
  drawings: Drawing[];
  indicators: Indicator[];
  messages: ChatMessage[];
}

// A whole-room snapshot: its id, when it went empty (grace-period bookkeeping), and its serialized state.
export interface PersistedRoom {
  id: string;
  emptySince: number | null;
  state: SerializedRoomState;
}

interface RoomRow {
  id: string;
  empty_since: number | null;
  state: string;
}

// SQLite-backed store for authoritative room state, so rooms survive a server restart
export class SqliteRoomStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // ":memory:" (used by tests) has no parent dir to create.
    if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        empty_since INTEGER,
        state TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  save(room: PersistedRoom): void {
    this.db
      .prepare(
        `INSERT INTO rooms (id, empty_since, state, updated_at)
         VALUES (@id, @emptySince, @state, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           empty_since = excluded.empty_since,
           state = excluded.state,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: room.id,
        emptySince: room.emptySince,
        state: JSON.stringify(room.state),
        updatedAt: Date.now(),
      });
  }

  load(id: string): PersistedRoom | undefined {
    const row = this.db
      .prepare("SELECT id, empty_since, state FROM rooms WHERE id = ?")
      .get(id) as RoomRow | undefined;
    return row ? this.rowToRoom(row) : undefined;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  }

  loadAll(): PersistedRoom[] {
    const rows = this.db
      .prepare("SELECT id, empty_since, state FROM rooms")
      .all() as RoomRow[];
    return rows.map((row) => this.rowToRoom(row));
  }

  close(): void {
    this.db.close();
  }

  private rowToRoom(row: RoomRow): PersistedRoom {
    return {
      id: row.id,
      emptySince: row.empty_since,
      state: JSON.parse(row.state) as SerializedRoomState,
    };
  }
}
