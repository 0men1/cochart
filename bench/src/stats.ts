// Turning a step's raw numbers into a pass/fail verdict.

import type { Slo, ValidityLimits } from "./config";
import type { Percentiles } from "./histogram";
import { portCeilingWarning } from "./hostLimits";

/** Server-side counters and gauges, diffed across a single step. */
export interface ServerStepMetrics {
  loopP99Ms: number | null;
  loopMaxMs: number | null;
  rssMb: number;
  rooms: number;
  clients: number;
  msgsIn: number;
  msgsOut: number;
  bytesOut: number;
  sendsDropped: number;
  flushes: number;
  flushedRooms: number;
  maxFlushMs: number;
}

export interface StepResult {
  /** The independent variable: users for single-room, rooms for many-rooms. */
  level: number;
  users: number;
  rooms: number;
  latency: Percentiles;
  joinsAttempted: number;
  joinsSucceeded: number;
  disconnects: number;
  errors: number;
  clientSends: number;
  /** http only: requests rejected with 429, i.e. the limiter was not raised. */
  rateLimited?: number;
  /** Worst per-worker event-loop p99 in the generator itself. */
  generatorLagP99Ms: number;
  /**
   * False for scenarios that legitimately produce no latency samples (idle-ws
   * holds sockets open without sending). Without this, "no samples" would be
   * reported as a broken measurement rather than the intended design.
   */
  expectsLatency: boolean;
  server: ServerStepMetrics | null;
  durationMs: number;
}

export interface Verdict {
  pass: boolean;
  breaches: string[];
  /** True when the harness cannot vouch for the numbers, whatever they say. */
  invalid: boolean;
  invalidReasons: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Evaluates one step against the SLO.
 *
 * `invalid` is kept separate from `pass` on purpose. A step where the generator
 * saturated is not a failing step — it is a step with no information in it, and
 * silently treating it as "capacity reached" would understate the server by
 * however much the harness was struggling.
 */
export function evaluate(
  step: StepResult,
  slo: Slo,
  validity: ValidityLimits,
): Verdict {
  const breaches: string[] = [];
  const invalidReasons: string[] = [];

  if (step.latency.count === 0) {
    if (step.expectsLatency) invalidReasons.push("no latency samples collected");
  } else {
    if (step.latency.p95 > slo.p95LatencyMs) {
      breaches.push(`p95 ${round(step.latency.p95)}ms > ${slo.p95LatencyMs}ms`);
    }
    if (step.latency.p99 > slo.p99LatencyMs) {
      breaches.push(`p99 ${round(step.latency.p99)}ms > ${slo.p99LatencyMs}ms`);
    }
  }

  const loopP99 = step.server?.loopP99Ms ?? null;
  if (loopP99 !== null && loopP99 > slo.serverLoopP99Ms) {
    breaches.push(`server event loop p99 ${round(loopP99)}ms > ${slo.serverLoopP99Ms}ms`);
  }

  // Checked separately from p99, which dilutes a single catastrophic freeze
  // across thousands of healthy samples.
  const loopMax = step.server?.loopMaxMs ?? null;
  if (loopMax !== null && loopMax > slo.serverLoopMaxMs) {
    breaches.push(
      `server stalled for ${round(loopMax)}ms in one go (limit ${slo.serverLoopMaxMs}ms)`,
    );
  }

  if (step.disconnects > slo.maxDisconnects) {
    breaches.push(`${step.disconnects} unexpected disconnect(s)`);
  }
  if (step.errors > slo.maxErrors) {
    breaches.push(`${step.errors} error(s)`);
  }
  if (step.server && step.server.sendsDropped > 0) {
    breaches.push(`${step.server.sendsDropped} server send(s) dropped`);
  }

  const joinRate =
    step.joinsAttempted === 0 ? 1 : step.joinsSucceeded / step.joinsAttempted;
  if (joinRate < slo.minJoinSuccessRate) {
    breaches.push(
      `join success ${(joinRate * 100).toFixed(1)}% < ${(slo.minJoinSuccessRate * 100).toFixed(0)}%`,
    );
    // Failed joins near the port ceiling are almost certainly the harness
    // running out of source ports. Reporting that as server capacity would
    // understate the server by however much headroom it still had.
    const ceiling = portCeilingWarning(step.joinsAttempted);
    if (ceiling) invalidReasons.push(ceiling);
  }

  // Harness-validity checks. Generator event-loop lag adds directly to every
  // latency sample it takes, so it is a lower bound on measurement error.
  if (step.generatorLagP99Ms > validity.maxGeneratorLagMs) {
    invalidReasons.push(
      `generator event loop p99 ${round(step.generatorLagP99Ms)}ms > ${validity.maxGeneratorLagMs}ms — the harness is saturated, not necessarily the server`,
    );
  }
  // Only meaningful once latency is high enough that harness overhead could
  // change the verdict; below the floor the step passes by a wide margin
  // regardless.
  if (
    step.latency.count > 0 &&
    step.latency.p99 >= validity.ratioCheckFloorMs &&
    step.generatorLagP99Ms / step.latency.p99 > validity.maxGeneratorLagRatio
  ) {
    invalidReasons.push(
      `generator lag is ${((step.generatorLagP99Ms / step.latency.p99) * 100).toFixed(0)}% of measured p99 — measurement dominated by the harness`,
    );
  }

  return {
    pass: breaches.length === 0,
    breaches,
    invalid: invalidReasons.length > 0,
    invalidReasons,
  };
}

/** Client->server frames per second the room actually absorbed, for context. */
export function throughput(step: StepResult) {
  const sec = step.durationMs / 1000;
  if (sec <= 0) return { msgsInPerSec: 0, msgsOutPerSec: 0, fanoutRatio: 0 };
  const msgsIn = step.server?.msgsIn ?? 0;
  const msgsOut = step.server?.msgsOut ?? 0;
  return {
    msgsInPerSec: msgsIn / sec,
    msgsOutPerSec: msgsOut / sec,
    // The amplification factor: how many sends each received frame costs.
    fanoutRatio: msgsIn === 0 ? 0 : msgsOut / msgsIn,
  };
}
