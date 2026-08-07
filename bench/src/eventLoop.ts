// Event-loop lag measurement for the generator itself.
//
// `monitorEventLoopDelay` schedules a timer every `resolution` ms and records
// how late it fires, so a completely idle loop still reports ~resolution. Left
// raw, that floor reads as ~10ms of lag and trips the harness-validity check on
// every run, falsely invalidating healthy results. Subtracting it makes the
// number mean "lag beyond expectation", matching what the server reports.

import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";

const RESOLUTION_MS = 10;

export function startLoopMonitor(): IntervalHistogram {
  const h = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
  h.enable();
  return h;
}

/** p99 lag in ms, with the sampler's own resolution floor removed. */
export function loopLagP99Ms(h: IntervalHistogram): number {
  if (h.count === 0) return 0;
  return Math.max(0, h.percentile(99) / 1e6 - RESOLUTION_MS);
}
