import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";

export const metricsEnabled = process.env.METRICS_ENABLED === "1";
const METRICS_TOKEN = process.env.METRICS_TOKEN ?? "";
const LOOP_RESOLUTION_MS = 10;

let loopDelay: IntervalHistogram | null = null;
if (metricsEnabled) {
  loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  loopDelay.enable();
}

export const counters = {
  wsJoins: 0,
  wsLeaves: 0,
  wsRejected: 0,
  msgsIn: 0,
  msgsOut: 0,
  bytesOut: 0,
  sendsDropped: 0,
  flushes: 0,
  flushedRooms: 0,
  lastFlushMs: 0,
  maxFlushMs: 0,
};

export type Counters = typeof counters;

function histogramMs(h: IntervalHistogram | null) {
  if (!h || h.count === 0) return null;
  const toMs = (ns: number) => {
    const excess = ns / 1e6 - LOOP_RESOLUTION_MS;
    return Math.round(Math.max(0, excess) * 1000) / 1000;
  };
  return {
    min: toMs(h.min),
    mean: Number.isFinite(h.mean) ? toMs(h.mean) : null,
    p50: toMs(h.percentile(50)),
    p90: toMs(h.percentile(90)),
    p99: toMs(h.percentile(99)),
    max: toMs(h.max),
    samples: h.count,
  };
}

export interface MetricsSnapshot {
  ts: number;
  uptimeMs: number;
  rooms: number;
  clients: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  cpu: { userMs: number; systemMs: number };
  /** null when METRICS_ENABLED is unset, or before any sample is taken. */
  eventLoopDelayMs: ReturnType<typeof histogramMs>;
  counters: Counters;
}

const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

export function snapshot(rooms: number, clients: number): MetricsSnapshot {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    ts: Date.now(),
    uptimeMs: Math.round(process.uptime() * 1000),
    rooms,
    clients,
    memory: {
      rssMb: toMb(mem.rss),
      heapUsedMb: toMb(mem.heapUsed),
      heapTotalMb: toMb(mem.heapTotal),
      externalMb: toMb(mem.external),
    },
    cpu: {
      userMs: Math.round(cpu.user / 1000),
      systemMs: Math.round(cpu.system / 1000),
    },
    eventLoopDelayMs: histogramMs(loopDelay),
    counters: { ...counters },
  };
}

export function reset(): void {
  loopDelay?.reset();
  for (const key of Object.keys(counters) as (keyof Counters)[]) {
    counters[key] = 0;
  }
}

/** True when the caller may read metrics. */
export function authorize(
  authHeader: string | undefined,
  tokenParam: string | null,
): boolean {
  if (!METRICS_TOKEN) return true;
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;
  return bearer === METRICS_TOKEN || tokenParam === METRICS_TOKEN;
}
