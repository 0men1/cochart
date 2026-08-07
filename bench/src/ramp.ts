// Capacity search: step the load up until the SLO breaks, then narrow the gap.
//
// A purely geometric ramp leaves the answer uncertain by the ramp factor — "it
// broke somewhere between 50 and 100 users" is not a number you can plan
// against. So a coarse doubling phase is followed by a bounded bisection
// between the last passing and first failing level.

import type { RunConfig } from "./config";
import { evaluate, type StepResult, type Verdict } from "./stats";
import type { ScenarioDef } from "./scenarios";
import type { MetricsClient } from "./metricsClient";

export interface StepRecord {
  step: StepResult;
  verdict: Verdict;
  phase: "coarse" | "refine" | "fixed";
}

export interface RampResult {
  records: StepRecord[];
  /** Highest level that met the SLO, or null if even the first level failed. */
  capacity: number | null;
  /** Lowest level observed to fail, or null if we never found one. */
  firstFailure: number | null;
  /** Why the search stopped, in plain language. */
  stoppedBecause: string;
  /** True when a result was contaminated by the harness rather than the server. */
  invalidated: boolean;
}

const MAX_REFINE_STEPS = 4;

export async function runFixed(
  cfg: RunConfig,
  scenario: ScenarioDef,
  metrics: MetricsClient,
  onStep: (r: StepRecord) => void,
): Promise<RampResult> {
  const level = scenario.name === "many-rooms" ? cfg.rooms : cfg.users;
  const step = await scenario.run(cfg, level, metrics);
  const verdict = evaluate(step, cfg.slo, cfg.validity);
  const record: StepRecord = { step, verdict, phase: "fixed" };
  onStep(record);
  return {
    records: [record],
    capacity: verdict.pass ? level : null,
    firstFailure: verdict.pass ? null : level,
    stoppedBecause: "fixed-load run (no ramp)",
    invalidated: verdict.invalid,
  };
}

export async function runRamp(
  cfg: RunConfig,
  scenario: ScenarioDef,
  metrics: MetricsClient,
  onStep: (r: StepRecord) => void,
): Promise<RampResult> {
  const records: StepRecord[] = [];
  let lastPass: number | null = null;
  let firstFail: number | null = null;
  let stoppedBecause = "";
  let invalidated = false;

  const measure = async (level: number, phase: StepRecord["phase"]) => {
    const step = await scenario.run(cfg, level, metrics);
    const verdict = evaluate(step, cfg.slo, cfg.validity);
    const record: StepRecord = { step, verdict, phase };
    records.push(record);
    onStep(record);
    return verdict;
  };

  // Coarse phase: multiply until something breaks.
  let level = Math.max(1, cfg.rampStart);
  while (level <= cfg.rampMaxLevel) {
    const verdict = await measure(level, "coarse");

    if (verdict.invalid) {
      invalidated = true;
      stoppedBecause =
        "the load generator became the bottleneck — results above this level are not trustworthy";
      break;
    }
    if (!verdict.pass) {
      firstFail = level;
      stoppedBecause = `SLO breached at ${level}`;
      break;
    }

    lastPass = level;
    const next = Math.max(level + 1, Math.floor(level * cfg.rampFactor));
    if (next > cfg.rampMaxLevel) {
      stoppedBecause = `reached the configured ceiling (--ramp-max ${cfg.rampMaxLevel}) without breaching the SLO`;
      break;
    }
    level = next;
  }

  // Refine phase: bisect the gap so the answer is not a factor-of-N range.
  if (lastPass !== null && firstFail !== null) {
    let low = lastPass;
    let high = firstFail;
    for (let i = 0; i < MAX_REFINE_STEPS && high - low > 1; i++) {
      // Stop once the remaining uncertainty is small relative to the answer.
      if ((high - low) / low <= 0.1) break;
      const mid = Math.floor((low + high) / 2);
      const verdict = await measure(mid, "refine");
      if (verdict.invalid) {
        invalidated = true;
        break;
      }
      if (verdict.pass) low = mid;
      else high = mid;
    }
    lastPass = low;
    firstFail = high;
    stoppedBecause = `SLO holds at ${low}, breaks at ${high}`;
  }

  if (!stoppedBecause) {
    stoppedBecause = lastPass === null ? "the first level already failed" : "ramp complete";
  }

  return {
    records,
    capacity: lastPass,
    firstFailure: firstFail,
    stoppedBecause,
    invalidated,
  };
}
