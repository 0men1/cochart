// Wire protocol shared by the collab WS handling and Room state.
// Chart + drawing payloads are opaque to the server: it only keys drawings by
// `id` and otherwise stores/relays them verbatim.

export const CollabAction = {
  INIT_ROOM: "INIT_ROOM", // client -> server: seed the room's initial truth
  SNAPSHOT: "SNAPSHOT", // server -> client: full authoritative state
  SELECT_CHART: "SELECT_CHART",
  ADD_DRAWING: "ADD_DRAWING",
  MODIFY_DRAWING: "MODIFY_DRAWING",
  DELETE_DRAWING: "DELETE_DRAWING",
} as const;

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
  };
}
