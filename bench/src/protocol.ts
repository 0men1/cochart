// Message contract between the main thread and the load workers.

import type { HistogramData } from "./histogram";

/** A room, and how many of its users this worker is responsible for. */
export interface Assignment {
  roomId: string;
  users: number;
  /**
   * True for exactly one assignment per room: that worker's first user sends
   * INIT_ROOM so the room has seeded state and joiners receive a snapshot, as
   * they would in the real app.
   */
  seed: boolean;
}

export interface WorkerConfig {
  wsTarget: string;
  cursorHz: number;
  duty: number;
  drawEditsPerMin: number;
  chatPerMin: number;
  connectRatePerSec: number;
  /** idle-ws: hold the socket open and never send anything. */
  silent: boolean;
}

export type MainToWorker =
  | { type: "connect"; assignments: Assignment[] }
  | { type: "measure" }
  | { type: "collect" }
  | { type: "stop" };

export type WorkerToMain =
  | { type: "connected"; joinsAttempted: number; joinsSucceeded: number; errors: number }
  | { type: "measuring" }
  | {
      type: "digest";
      latency: HistogramData;
      joinsAttempted: number;
      joinsSucceeded: number;
      disconnects: number;
      errors: number;
      clientSends: number;
      /** This worker's own event-loop delay p99, in ms. */
      loopP99Ms: number;
      openSockets: number;
    }
  | { type: "stopped" };
