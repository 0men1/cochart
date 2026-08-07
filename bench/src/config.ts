// Scenario defaults and the definition of "capacity".

import { cpus } from "node:os";

export type ScenarioName = "http" | "idle-ws" | "single-room" | "many-rooms";

/**
 * Capacity is the highest load level that holds every one of these for a
 * sustained window after warmup. They are deliberately explicit: without a
 * written-down SLO, "how many users can we carry" has no answer.
 */
export interface Slo {
  /** Cursors are sent at 25 Hz; past ~150 ms a peer cursor stops feeling live. */
  p95LatencyMs: number;
  /** Tail budget — the worst experience anyone in the room is having. */
  p99LatencyMs: number;
  /**
   * Server event-loop delay. This is the explanatory signal: the server is
   * single-threaded, so once the loop is behind, every client lags regardless
   * of room.
   */
  serverLoopP99Ms: number;
  /**
   * Worst single event-loop stall tolerated.
   *
   * p99 alone misses this failure mode: a server frozen for 50 seconds fires
   * its sampler only a handful of times, so one catastrophic stall is diluted
   * by thousands of healthy samples and p99 still reads low. The max catches
   * exactly the case where the server stops answering entirely.
   */
  serverLoopMaxMs: number;
  maxDisconnects: number;
  maxErrors: number;
  minJoinSuccessRate: number;
}

export const DEFAULT_SLO: Slo = {
  p95LatencyMs: 150,
  p99LatencyMs: 400,
  serverLoopP99Ms: 100,
  serverLoopMaxMs: 1000,
  maxDisconnects: 0,
  maxErrors: 0,
  minJoinSuccessRate: 1,
};

/**
 * Thresholds for deciding the *harness* is the bottleneck rather than the
 * server. A load generator that saturates its own event loop reports its own
 * stalls as server latency, which is the most common way a load test lies.
 */
export interface ValidityLimits {
  /** Absolute generator event-loop p99 above which samples are untrustworthy. */
  maxGeneratorLagMs: number;
  /** Or: generator lag as a fraction of measured p99 latency. */
  maxGeneratorLagRatio: number;
  /**
   * Floor below which the ratio check is skipped.
   *
   * When the server answers in 2 ms, a 2.5 ms generator overhead is 125% of the
   * measurement and yet completely irrelevant — the step passes by two orders
   * of magnitude either way. The ratio only tells us something once latency is
   * large enough that harness overhead could actually flip the verdict.
   */
  ratioCheckFloorMs: number;
}

export const DEFAULT_VALIDITY: ValidityLimits = {
  maxGeneratorLagMs: 50,
  maxGeneratorLagRatio: 0.5,
  ratioCheckFloorMs: 20,
};

export interface RunConfig {
  scenario: ScenarioName;
  /** Base HTTP origin of the server under test, e.g. http://localhost:4000 */
  target: string;
  /** WebSocket origin. Derived from `target` unless overridden. */
  wsTarget: string;
  metricsToken: string;

  /** Fixed-load mode: exact level to run. Ignored when `ramp` is set. */
  users: number;
  rooms: number;

  /** Auto-ramp: step until the SLO breaks, then report the last passing level. */
  ramp: boolean;
  rampStart: number;
  rampFactor: number;
  rampMaxLevel: number;

  /** Seconds to let connections settle before sampling. */
  warmupSec: number;
  /** Seconds of measured steady state per step. */
  holdSec: number;

  /**
   * Fraction of time a virtual user is actively moving their cursor. Real users
   * are not moving constantly; 1.0 is the worst case, not the typical one.
   */
  duty: number;
  /** Cursor sends per second while active — matches the web client's throttle. */
  cursorHz: number;
  /** Drawing edits per user per minute. These are what mark a room dirty. */
  drawEditsPerMin: number;
  /** Chat messages per user per minute. Also marks the room dirty. */
  chatPerMin: number;

  /** New sockets opened per second. Prevents accept-backlog overflow. */
  connectRatePerSec: number;
  workers: number;

  /**
   * HTTP scenario only. "cached" uses historical block-aligned ranges that stay
   * inside the server's cache, measuring CoChart's own serving capacity. "live"
   * requests the trailing partial block, which bypasses both the cache and
   * single-flight coalescing and hits the exchange on every call — see
   * server/src/market/service.ts:74-88. Dangerous; see bench/README.md.
   */
  upstream: "cached" | "live";
  /** HTTP scenario: seconds a virtual user waits between requests. */
  thinkSec: number;
  /** HTTP scenario: fraction of requests that hit /api/search instead of candles. */
  searchRatio: number;

  slo: Slo;
  validity: ValidityLimits;
  /** Write the full per-step result table here as JSON. */
  out: string | null;
  verbose: boolean;
}

export const CURSOR_HZ = 25; // mirrors CURSOR_THROTTLE_MS = 40 in the web client

export function defaultConfig(): RunConfig {
  return {
    scenario: "single-room",
    target: "http://localhost:4000",
    wsTarget: "ws://localhost:4000",
    metricsToken: "",
    users: 10,
    rooms: 1,
    ramp: false,
    rampStart: 5,
    rampFactor: 2,
    rampMaxLevel: 20_000,
    warmupSec: 5,
    holdSec: 20,
    duty: 0.3,
    cursorHz: CURSOR_HZ,
    drawEditsPerMin: 6,
    chatPerMin: 1,
    connectRatePerSec: 200,
    // Leave headroom: the server under test needs a core, and so does this
    // process's main thread.
    workers: Math.max(1, Math.min(8, cpus().length - 2)),
    upstream: "cached",
    thinkSec: 5,
    searchRatio: 0.2,
    slo: { ...DEFAULT_SLO },
    validity: { ...DEFAULT_VALIDITY },
    out: null,
    verbose: false,
  };
}
