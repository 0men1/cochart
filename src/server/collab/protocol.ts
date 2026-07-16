export const CollabAction = {
  INIT_ROOM: "INIT_ROOM", // client -> server: seed the room's initial truth
  SNAPSHOT: "SNAPSHOT", // server -> client: full authoritative state
  SELECT_CHART: "SELECT_CHART",
  ADD_DRAWING: "ADD_DRAWING",
  MODIFY_DRAWING: "MODIFY_DRAWING",
  DELETE_DRAWING: "DELETE_DRAWING",
  PRESENCE: "PRESENCE", // server -> clients: the room's active-user roster
  UPDATE_PRESENCE: "UPDATE_PRESENCE", // client -> server: change my displayName/color
  CURSOR: "CURSOR", // client -> peers: ephemeral live cursor position (never stored)
} as const;

// Anonymous per-connection identity, echoed to peers for presence display.
export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
}

export interface Drawing {
  id: string;
  [key: string]: unknown;
}

export interface ChartSelection {
  product: unknown;
  timeframe: unknown;
}

export interface IncomingAction {
  type?: string;
  payload?: {
    product?: unknown;
    timeframe?: unknown;
    drawing?: Drawing;
    drawingId?: string;
    drawings?: Drawing[];
    displayName?: string;
    color?: string;
    // CURSOR payload: chart-coordinate position (time + price) so peers can
    // re-project it to their own pixels; `hidden` clears a departed cursor.
    userId?: string;
    time?: number;
    price?: number;
    hidden?: boolean;
  };
}
