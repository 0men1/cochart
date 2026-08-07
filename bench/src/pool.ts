// Main-thread orchestration for a single load level.
//
// Lifecycle per level: spawn workers -> connect (rate-limited) -> warm up ->
// reset both sides' counters -> hold and measure -> collect -> tear down.
// Counters are reset *after* warmup so connection-storm cost never lands in the
// steady-state numbers; the storm is measured separately where it matters.

import { Worker } from "node:worker_threads";
import type { RunConfig } from "./config";
import { Histogram } from "./histogram";
import type { MetricsClient } from "./metricsClient";
import type { Assignment, MainToWorker, WorkerToMain } from "./protocol";
import type { StepResult } from "./stats";

const WORKER_URL = new URL("./worker.ts", import.meta.url);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Splits rooms and their users across workers.
 *
 * With at least one room per worker, whole rooms are handed out round-robin.
 * With fewer rooms than workers (the single-room case) each room's users are
 * spread across all of them, which is the only way to generate enough load for
 * a big room without one worker becoming the bottleneck.
 */
export function planAssignments(
  rooms: string[],
  usersPerRoom: number,
  workers: number,
): Assignment[][] {
  const plan: Assignment[][] = Array.from({ length: workers }, () => []);
  if (rooms.length === 0 || usersPerRoom === 0) return plan;

  if (rooms.length >= workers) {
    rooms.forEach((roomId, i) => {
      plan[i % workers].push({ roomId, users: usersPerRoom, seed: true });
    });
    return plan;
  }

  for (const roomId of rooms) {
    let seeded = false;
    for (let w = 0; w < workers; w++) {
      // Spread the remainder across the leading workers rather than piling it
      // onto one.
      const share = Math.floor(usersPerRoom / workers) + (w < usersPerRoom % workers ? 1 : 0);
      if (share === 0) continue;
      plan[w].push({ roomId, users: share, seed: !seeded });
      seeded = true;
    }
  }
  return plan;
}

function awaitMessage<T extends WorkerToMain["type"]>(
  worker: Worker,
  type: T,
): Promise<Extract<WorkerToMain, { type: T }>> {
  return new Promise((resolve, reject) => {
    const onMessage = (msg: WorkerToMain) => {
      if (msg.type !== type) return;
      cleanup();
      resolve(msg as Extract<WorkerToMain, { type: T }>);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      worker.off("message", onMessage);
      worker.off("error", onError);
    };
    worker.on("message", onMessage);
    worker.on("error", onError);
  });
}

function post(worker: Worker, msg: MainToWorker): void {
  worker.postMessage(msg);
}

export interface LevelSpec {
  rooms: string[];
  usersPerRoom: number;
  /** idle-ws: hold sockets open without sending. */
  silent: boolean;
  /** Reported as the independent variable in the results table. */
  level: number;
}

export async function runLevel(
  cfg: RunConfig,
  spec: LevelSpec,
  metrics: MetricsClient,
): Promise<StepResult> {
  const totalUsers = spec.rooms.length * spec.usersPerRoom;
  const workerCount = Math.max(1, Math.min(cfg.workers, totalUsers));
  const plan = planAssignments(spec.rooms, spec.usersPerRoom, workerCount);

  const workers = plan.map(
    () =>
      new Worker(WORKER_URL, {
        workerData: {
          wsTarget: cfg.wsTarget,
          cursorHz: cfg.cursorHz,
          duty: cfg.duty,
          drawEditsPerMin: cfg.drawEditsPerMin,
          chatPerMin: cfg.chatPerMin,
          // Each worker connects independently, so give each its share of the
          // global connect budget or the aggregate rate overshoots.
          connectRatePerSec: Math.max(1, Math.floor(cfg.connectRatePerSec / workerCount)),
          silent: spec.silent,
        },
        // tsx's ESM hooks are per-thread; without this the worker cannot load a
        // .ts entrypoint.
        execArgv: ["--import", "tsx"],
      }),
  );

  try {
    // Connect.
    const connected = workers.map((w, i) => {
      const done = awaitMessage(w, "connected");
      post(w, { type: "connect", assignments: plan[i] });
      return done;
    });
    const connectResults = await Promise.all(connected);

    await sleep(cfg.warmupSec * 1000);

    // Open the measurement window on both sides.
    await metrics.beginStep();
    const measuring = workers.map((w) => {
      const done = awaitMessage(w, "measuring");
      post(w, { type: "measure" });
      return done;
    });
    await Promise.all(measuring);

    const startedAt = Date.now();
    await sleep(cfg.holdSec * 1000);

    // Collect.
    const digests = await Promise.all(
      workers.map((w) => {
        const done = awaitMessage(w, "digest");
        post(w, { type: "collect" });
        return done;
      }),
    );
    const durationMs = Date.now() - startedAt;
    const server = await metrics.endStep();

    const latency = new Histogram();
    let disconnects = 0;
    let errors = 0;
    let clientSends = 0;
    let generatorLagP99Ms = 0;
    for (const d of digests) {
      latency.merge(d.latency);
      disconnects += d.disconnects;
      errors += d.errors;
      clientSends += d.clientSends;
      // Worst worker, not the average: one saturated worker is enough to
      // contaminate the samples it took.
      generatorLagP99Ms = Math.max(generatorLagP99Ms, d.loopP99Ms);
    }

    return {
      level: spec.level,
      users: totalUsers,
      rooms: spec.rooms.length,
      latency: latency.summary(),
      joinsAttempted: connectResults.reduce((n, c) => n + c.joinsAttempted, 0),
      joinsSucceeded: connectResults.reduce((n, c) => n + c.joinsSucceeded, 0),
      disconnects,
      errors: errors + connectResults.reduce((n, c) => n + c.errors, 0),
      clientSends,
      generatorLagP99Ms,
      expectsLatency: !spec.silent,
      server,
      durationMs,
    };
  } finally {
    await Promise.all(
      workers.map(async (w) => {
        try {
          const stopped = awaitMessage(w, "stopped");
          post(w, { type: "stop" });
          await Promise.race([stopped, sleep(5000)]);
        } catch {
          // worker already gone
        }
        await w.terminate();
      }),
    );
    // Let the server notice the closes and reap before the next level starts,
    // so one level's teardown is not attributed to the next level's load.
    await sleep(1000);
  }
}
