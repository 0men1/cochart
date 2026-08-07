import { describe, expect, it } from "vitest";
import { DEFAULT_SLO, DEFAULT_VALIDITY } from "./config";
import { EPHEMERAL_PORTS } from "./hostLimits";
import { evaluate, throughput, type ServerStepMetrics, type StepResult } from "./stats";

function step(overrides: Partial<StepResult> = {}): StepResult {
  return {
    level: 10,
    users: 10,
    rooms: 1,
    latency: { count: 1000, min: 1, mean: 20, p50: 18, p95: 40, p99: 90, max: 120 },
    joinsAttempted: 10,
    joinsSucceeded: 10,
    disconnects: 0,
    errors: 0,
    clientSends: 5000,
    generatorLagP99Ms: 2,
    expectsLatency: true,
    server: null,
    durationMs: 20_000,
    ...overrides,
  };
}

function server(overrides: Partial<ServerStepMetrics> = {}): ServerStepMetrics {
  return {
    loopP99Ms: 5,
    loopMaxMs: 12,
    rssMb: 90,
    rooms: 1,
    clients: 10,
    msgsIn: 5000,
    msgsOut: 45_000,
    bytesOut: 5_400_000,
    sendsDropped: 0,
    flushes: 4,
    flushedRooms: 4,
    maxFlushMs: 2,
    ...overrides,
  };
}

describe("evaluate", () => {
  it("passes a healthy step", () => {
    const v = evaluate(step({ server: server() }), DEFAULT_SLO, DEFAULT_VALIDITY);
    expect(v.pass).toBe(true);
    expect(v.invalid).toBe(false);
    expect(v.breaches).toEqual([]);
  });

  it("fails on p95 latency", () => {
    const v = evaluate(
      step({ latency: { count: 100, min: 1, mean: 90, p50: 80, p95: 200, p99: 300, max: 400 } }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(false);
    expect(v.breaches.join(" ")).toContain("p95");
  });

  it("fails on server event-loop saturation even when latency still looks fine", () => {
    const v = evaluate(
      step({ server: server({ loopP99Ms: 250 }) }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(false);
    expect(v.breaches.join(" ")).toContain("event loop");
  });

  it("fails on dropped server sends", () => {
    const v = evaluate(
      step({ server: server({ sendsDropped: 3 }) }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(false);
    expect(v.breaches.join(" ")).toContain("dropped");
  });

  it("fails on partial joins", () => {
    const v = evaluate(
      step({ joinsAttempted: 100, joinsSucceeded: 97 }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(false);
    expect(v.breaches.join(" ")).toContain("join success");
  });

  it("treats no samples as invalid rather than as a pass", () => {
    const v = evaluate(
      step({ latency: { count: 0, min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 } }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.invalid).toBe(true);
    // No samples means no latency breach was recorded either.
    expect(v.breaches.join(" ")).not.toContain("p95");
  });

  it("marks a step invalid when the generator's own loop is stalling", () => {
    const v = evaluate(step({ generatorLagP99Ms: 120 }), DEFAULT_SLO, DEFAULT_VALIDITY);
    expect(v.invalid).toBe(true);
    expect(v.invalidReasons.join(" ")).toContain("harness is saturated");
  });

  it("marks a step invalid when generator lag dominates the measurement", () => {
    // Under the 50ms absolute floor, but most of a measured p99 that is high
    // enough for the overhead to matter.
    const v = evaluate(
      step({
        generatorLagP99Ms: 30,
        latency: { count: 500, min: 1, mean: 20, p50: 18, p95: 35, p99: 40, max: 60 },
      }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.invalid).toBe(true);
    expect(v.invalidReasons.join(" ")).toContain("dominated by the harness");
  });

  it("does not apply the ratio check when latency is trivially low", () => {
    // A healthy 3-user room: 2ms p99 against 2.5ms of harness overhead is a
    // 125% ratio that says nothing — the step passes by orders of magnitude.
    const v = evaluate(
      step({
        generatorLagP99Ms: 2.5,
        latency: { count: 1200, min: 0.5, mean: 1.2, p50: 1, p95: 1, p99: 2, max: 9 },
      }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.invalid).toBe(false);
    expect(v.pass).toBe(true);
  });

  it("keeps invalid independent of pass, so a saturated harness is not read as capacity", () => {
    const v = evaluate(step({ generatorLagP99Ms: 200 }), DEFAULT_SLO, DEFAULT_VALIDITY);
    expect(v.invalid).toBe(true);
    expect(v.pass).toBe(true); // the server's own numbers were still within SLO
  });
});

describe("throughput", () => {
  it("reports the fan-out amplification factor", () => {
    const t = throughput(step({ server: server({ msgsIn: 5000, msgsOut: 45_000 }) }));
    expect(t.fanoutRatio).toBe(9); // 10-person room: each frame relayed to 9 peers
    expect(t.msgsInPerSec).toBe(250);
    expect(t.msgsOutPerSec).toBe(2250);
  });

  it("does not divide by zero on an empty step", () => {
    expect(throughput(step({ durationMs: 0 }))).toEqual({
      msgsInPerSec: 0,
      msgsOutPerSec: 0,
      fanoutRatio: 0,
    });
    expect(throughput(step({ server: server({ msgsIn: 0 }) })).fanoutRatio).toBe(0);
  });
});

describe("event-loop stall detection", () => {
  it("fails on a single long stall even when p99 looks healthy", () => {
    // The 10k-connection failure mode: the server freezes outright, but the
    // sampler fires so rarely during the freeze that p99 stays low.
    const v = evaluate(
      step({ server: server({ loopP99Ms: 3, loopMaxMs: 48_000 }) }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(false);
    expect(v.breaches.join(" ")).toContain("stalled");
  });

  it("tolerates a stall inside the budget", () => {
    const v = evaluate(
      step({ server: server({ loopMaxMs: 200 }) }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(true);
  });
});

describe("host-limit attribution", () => {
  it("does not blame the harness for join failures well below the port ceiling", () => {
    const v = evaluate(
      step({ joinsAttempted: 200, joinsSucceeded: 150 }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.pass).toBe(false);
    expect(v.invalidReasons.join(" ")).not.toContain("ephemeral port");
  });

  it("attributes join failures near the port ceiling to the harness", () => {
    const ports = EPHEMERAL_PORTS;
    if (ports === null) return; // platform without a readable range
    const v = evaluate(
      step({ joinsAttempted: ports, joinsSucceeded: Math.floor(ports * 0.9) }),
      DEFAULT_SLO,
      DEFAULT_VALIDITY,
    );
    expect(v.invalid).toBe(true);
    expect(v.invalidReasons.join(" ")).toContain("ephemeral port ceiling");
  });
});
