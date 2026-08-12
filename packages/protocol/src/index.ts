// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

// Works in the browser and in Node. `debug`/`info` are silenced in production
// so dev noise doesn't ship; `warn`/`error` always emit.
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "6H": 21600,
  "1D": 86400,
};

// ---------------------------------------------------------------------------
// Collaboration wire protocol
// ---------------------------------------------------------------------------
export const CollabAction = {
  INIT_ROOM: "INIT_ROOM", // client -> server: seed the room's initial truth
  SNAPSHOT: "SNAPSHOT", // server -> client: full authoritative state
  SELECT_CHART: "SELECT_CHART",
  ADD_DRAWING: "ADD_DRAWING",
  MODIFY_DRAWING: "MODIFY_DRAWING",
  DELETE_DRAWING: "DELETE_DRAWING",
  ADD_INDICATOR: "ADD_INDICATOR",
  MODIFY_INDICATOR: "MODIFY_INDICATOR",
  REMOVE_INDICATOR: "REMOVE_INDICATOR",
  PRESENCE: "PRESENCE", // server -> clients: the room's active-user roster
  UPDATE_PRESENCE: "UPDATE_PRESENCE", // client -> server: change my displayName/color
  CURSOR: "CURSOR", // client -> peers: ephemeral live cursor position (never stored)
  CHAT: "CHAT", // client -> server (text); server -> clients (full message)
  DRAWING_DRAG: "DRAWING_DRAG", // client -> peers: ephemeral in-progress drag points (never stored)
} as const;

export type CollabAction = (typeof CollabAction)[keyof typeof CollabAction];

export const WS_CLOSE_REPLACED = 4000;

// Anonymous per-connection identity, echoed to peers for presence display.
export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
}

// A room chat message. The server builds this from the sender's connection
// identity so a client can only ever supply the `text`.
export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  color: string;
  text: string;
  timestamp: number;
}

export interface Drawing {
  id: string;
  [key: string]: unknown;
}

// Indicators are plain config objects; like drawings the room treats them as
// opaque and only keys off `id`.
export interface Indicator {
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
    indicator?: Indicator;
    indicatorId?: string;
    indicators?: Indicator[];
    displayName?: string;
    color?: string;
    // CHAT payload: the raw message text a client wants to send.
    text?: string;
    // DRAWING_DRAG payload: in-progress drawing points, relayed opaquely.
    points?: unknown[];
    // CURSOR payload: chart-coordinate position (time + price) so peers can
    // re-project it to their own pixels; `hidden` clears a departed cursor.
    userId?: string;
    time?: number;
    price?: number;
    hidden?: boolean;
  };
}
