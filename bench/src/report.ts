// Console output and the JSON artifact.
//
// The per-step table matters as much as the headline number: a gentle slope
// means headroom degrades predictably, a cliff means the next user past the
// limit takes everyone down with them. You cannot tell those apart from a
// single capacity figure.

import { writeFileSync } from "node:fs";
import type { RunConfig } from "./config";
import type { RampResult, StepRecord } from "./ramp";
import type { ScenarioDef } from "./scenarios";
import { throughput } from "./stats";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const ms = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${n.toFixed(1)}`;

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

function pad(value: string, width: number, right = true): string {
  return right ? value.padStart(width) : value.padEnd(width);
}

const COLUMNS: { header: string; width: number }[] = [
  { header: "level", width: 7 },
  { header: "users", width: 7 },
  { header: "rooms", width: 6 },
  { header: "p50", width: 8 },
  { header: "p95", width: 8 },
  { header: "p99", width: 8 },
  { header: "loop p99", width: 9 },
  { header: "out/s", width: 8 },
  { header: "fanout", width: 7 },
  { header: "rss", width: 7 },
  { header: "flush", width: 8 },
  { header: "verdict", width: 8 },
];

export function printHeader(scenario: ScenarioDef, cfg: RunConfig): void {
  console.log(`\n${BOLD}${scenario.question}${RESET}`);
  console.log(`${DIM}scenario ${scenario.name} against ${cfg.target}${RESET}`);
  console.log(
    `${DIM}SLO: p95<=${cfg.slo.p95LatencyMs}ms, p99<=${cfg.slo.p99LatencyMs}ms, server loop p99<=${cfg.slo.serverLoopP99Ms}ms, no drops${RESET}`,
  );
  if (scenario.name !== "http") {
    console.log(
      `${DIM}traffic: ${cfg.cursorHz}Hz cursors at ${(cfg.duty * 100).toFixed(0)}% duty, ${cfg.drawEditsPerMin} draw edits/user/min${RESET}`,
    );
  }
  console.log();
  console.log(DIM + COLUMNS.map((c) => pad(c.header, c.width)).join(" ") + RESET);
}

export function printStep(record: StepRecord, cfg: RunConfig): void {
  const { step, verdict } = record;
  const t = throughput(step);
  const verdictText = verdict.invalid
    ? `${YELLOW}INVALID${RESET}`
    : verdict.pass
      ? `${GREEN}pass${RESET}`
      : `${RED}FAIL${RESET}`;

  const cells = [
    pad(String(step.level), COLUMNS[0].width),
    pad(String(step.users), COLUMNS[1].width),
    pad(String(step.rooms), COLUMNS[2].width),
    pad(ms(step.latency.p50), COLUMNS[3].width),
    pad(ms(step.latency.p95), COLUMNS[4].width),
    pad(ms(step.latency.p99), COLUMNS[5].width),
    pad(ms(step.server?.loopP99Ms ?? null), COLUMNS[6].width),
    pad(compact(t.msgsOutPerSec), COLUMNS[7].width),
    pad(t.fanoutRatio ? `${t.fanoutRatio.toFixed(0)}x` : "-", COLUMNS[8].width),
    pad(step.server ? `${step.server.rssMb.toFixed(0)}M` : "-", COLUMNS[9].width),
    pad(step.server ? ms(step.server.maxFlushMs) : "-", COLUMNS[10].width),
    pad(verdictText, COLUMNS[11].width + verdictText.length - stripAnsi(verdictText).length),
  ];
  console.log(cells.join(" "));

  if (record.phase === "refine") {
    console.log(`${DIM}   ^ refining between the last pass and first failure${RESET}`);
  }
  for (const reason of verdict.invalidReasons) {
    console.log(`   ${YELLOW}! ${reason}${RESET}`);
  }
  for (const breach of verdict.breaches) {
    console.log(`   ${RED}x ${breach}${RESET}`);
  }
  if (step.rateLimited) {
    console.log(
      `   ${YELLOW}! ${step.rateLimited} request(s) got 429 — this is the per-IP limiter, not server capacity. Restart the server with RATE_LIMIT_CANDLES / RATE_LIMIT_SEARCH raised.${RESET}`,
    );
  }
  if (cfg.verbose && step.server) {
    console.log(
      `${DIM}   msgsIn=${compact(step.server.msgsIn)} msgsOut=${compact(step.server.msgsOut)} bytesOut=${compact(step.server.bytesOut)} flushes=${step.server.flushes} flushedRooms=${step.server.flushedRooms} samples=${compact(step.latency.count)} genLagP99=${ms(step.generatorLagP99Ms)}ms${RESET}`,
    );
  }
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export function printSummary(
  result: RampResult,
  scenario: ScenarioDef,
  cfg: RunConfig,
  metricsUnavailable: string | null,
): void {
  console.log();
  if (metricsUnavailable) {
    console.log(
      `${YELLOW}Server metrics unavailable: ${metricsUnavailable}${RESET}\n${DIM}Latency was still measured, but without event-loop data a slowdown cannot be attributed to server saturation.${RESET}\n`,
    );
  }

  if (result.capacity === null) {
    console.log(`${RED}${BOLD}No capacity established.${RESET} ${result.stoppedBecause}`);
  } else {
    const unit = scenario.levelLabel;
    console.log(`${BOLD}Capacity: ${result.capacity} ${unit}${RESET} ${DIM}(${result.stoppedBecause})${RESET}`);

    const best = result.records.filter((r) => r.verdict.pass).at(-1);
    if (best && scenario.name === "many-rooms") {
      console.log(`${DIM}  = ${best.step.users} concurrent users across ${best.step.rooms} rooms${RESET}`);
    }
  }

  if (result.invalidated) {
    console.log(
      `\n${YELLOW}Caution: at least one step was invalidated because the load generator saturated.${RESET}`,
    );
    console.log(
      `${DIM}The real server limit is at or above the last valid level. Re-run with more --workers, or drive load from a second machine.${RESET}`,
    );
  }

  // The shape of the curve, not just the breaking point.
  const passing = result.records.filter((r) => r.verdict.pass && r.step.latency.count > 0);
  if (passing.length >= 2) {
    const first = passing[0];
    const last = passing.at(-1)!;
    const growth = last.step.latency.p95 / Math.max(first.step.latency.p95, 0.01);
    console.log(
      `\n${DIM}Degradation: p95 went ${ms(first.step.latency.p95)}ms -> ${ms(last.step.latency.p95)}ms (${growth.toFixed(1)}x) between ${first.step.level} and ${last.step.level} ${scenario.levelLabel}.${RESET}`,
    );
  }
}

export function writeJson(
  path: string,
  result: RampResult,
  scenario: ScenarioDef,
  cfg: RunConfig,
): void {
  const payload = {
    scenario: scenario.name,
    question: scenario.question,
    levelLabel: scenario.levelLabel,
    ranAt: new Date().toISOString(),
    target: cfg.target,
    slo: cfg.slo,
    validity: cfg.validity,
    traffic: {
      cursorHz: cfg.cursorHz,
      duty: cfg.duty,
      drawEditsPerMin: cfg.drawEditsPerMin,
      chatPerMin: cfg.chatPerMin,
      warmupSec: cfg.warmupSec,
      holdSec: cfg.holdSec,
      workers: cfg.workers,
    },
    capacity: result.capacity,
    firstFailure: result.firstFailure,
    stoppedBecause: result.stoppedBecause,
    invalidated: result.invalidated,
    steps: result.records.map((r) => ({
      phase: r.phase,
      ...r.step,
      throughput: throughput(r.step),
      verdict: r.verdict,
    })),
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`${DIM}\nFull results written to ${path}${RESET}`);
}
