// The four capacity scenarios.

import type { RunConfig, ScenarioName } from "./config";
import { runHttpLevel } from "./httpLoad";
import { createRoom, type MetricsClient } from "./metricsClient";
import { runLevel } from "./pool";
import type { StepResult } from "./stats";

/**
 * Room size for the idle-connection scenario. Kept small deliberately: presence
 * is rebroadcast to the whole room on every join (server/src/collab/room.ts:93),
 * so packing idle users into few large rooms would measure that O(N^2) join
 * cost instead of the per-connection cost we are after here.
 */
const IDLE_USERS_PER_ROOM = 10;

async function createRooms(target: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  // Modest concurrency: room creation is cheap, but a burst of thousands of
  // POSTs would queue behind itself and skew the level's start time.
  const CONCURRENCY = 16;
  for (let i = 0; i < count; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, count - i);
    const created = await Promise.all(
      Array.from({ length: batch }, () => createRoom(target)),
    );
    ids.push(...created);
  }
  return ids;
}

export interface ScenarioDef {
  name: ScenarioName;
  /** Name of the independent variable, for the results table. */
  levelLabel: string;
  question: string;
  describe(cfg: RunConfig, level: number): string;
  run(cfg: RunConfig, level: number, metrics: MetricsClient): Promise<StepResult>;
}

const singleRoom: ScenarioDef = {
  name: "single-room",
  levelLabel: "users",
  question: "How many users can we carry in a single room?",
  describe: (_cfg, level) => `${level} users in 1 room`,
  async run(cfg, level, metrics) {
    const rooms = await createRooms(cfg.target, 1);
    return runLevel(cfg, { rooms, usersPerRoom: level, silent: false, level }, metrics);
  },
};

const manyRooms: ScenarioDef = {
  name: "many-rooms",
  levelLabel: "rooms",
  question: "How many rooms at full occupancy can we carry?",
  describe: (cfg, level) => `${level} rooms x ${cfg.users} users = ${level * cfg.users} users`,
  async run(cfg, level, metrics) {
    const rooms = await createRooms(cfg.target, level);
    return runLevel(cfg, { rooms, usersPerRoom: cfg.users, silent: false, level }, metrics);
  },
};

const idleWs: ScenarioDef = {
  name: "idle-ws",
  levelLabel: "connections",
  question: "How many open connections can we hold, independent of traffic?",
  describe: (_cfg, level) =>
    `${level} silent connections across ${Math.ceil(level / IDLE_USERS_PER_ROOM)} rooms`,
  async run(cfg, level, metrics) {
    const roomCount = Math.max(1, Math.ceil(level / IDLE_USERS_PER_ROOM));
    const rooms = await createRooms(cfg.target, roomCount);
    const usersPerRoom = Math.max(1, Math.round(level / roomCount));
    return runLevel(cfg, { rooms, usersPerRoom, silent: true, level }, metrics);
  },
};

const http: ScenarioDef = {
  name: "http",
  levelLabel: "users",
  question: "How many users can we carry who are NOT in rooms?",
  describe: (cfg, level) =>
    `${level} solo users, ~${(level / cfg.thinkSec).toFixed(0)} req/s (${cfg.upstream})`,
  run: (cfg, level, metrics) => runHttpLevel(cfg, level, metrics),
};

export const SCENARIOS: Record<ScenarioName, ScenarioDef> = {
  "single-room": singleRoom,
  "many-rooms": manyRooms,
  "idle-ws": idleWs,
  http,
};
