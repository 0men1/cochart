// Reads /api/metrics off the server under test.
//
// Counters are zeroed at the start of each step (?reset=1), so the values read
// at the end of the step belong to that step alone — no diffing, and no
// averages smeared across every preceding step of a ramp.

import type { ServerStepMetrics } from "./stats";

interface RawSnapshot {
  rooms: number;
  clients: number;
  memory: { rssMb: number };
  eventLoopDelayMs: { p99: number; max: number } | null;
  counters: {
    msgsIn: number;
    msgsOut: number;
    bytesOut: number;
    sendsDropped: number;
    flushes: number;
    flushedRooms: number;
    maxFlushMs: number;
  };
}

export class MetricsClient {
  private unavailableReason: string | null = null;
  private everSucceeded = false;

  constructor(
    private readonly target: string,
    private readonly token: string,
  ) {}

  /**
   * A reason to warn about, or null.
   *
   * Only reports when metrics were *never* readable. A mid-run failure is
   * usually the server being too saturated to answer HTTP — which is a finding,
   * not a harness problem — and the affected steps already show "-" in the
   * table. Warning globally in that case would wrongly imply the whole run was
   * blind.
   */
  get unavailable(): string | null {
    return this.everSucceeded ? null : this.unavailableReason;
  }

  private async read(reset: boolean): Promise<RawSnapshot | null> {
    const url = new URL("/api/metrics", this.target);
    if (reset) url.searchParams.set("reset", "1");
    try {
      const res = await fetch(url, {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 404) {
        this.unavailableReason =
          "server returned 404 — start it with METRICS_ENABLED=1 to get event-loop data";
        return null;
      }
      if (res.status === 401) {
        this.unavailableReason = "server returned 401 — pass --metrics-token to match METRICS_TOKEN";
        return null;
      }
      if (!res.ok) {
        this.unavailableReason = `server returned ${res.status}`;
        return null;
      }
      this.everSucceeded = true;
      return (await res.json()) as RawSnapshot;
    } catch (err) {
      this.unavailableReason = `could not reach /api/metrics (${(err as Error).message})`;
      return null;
    }
  }

  /** Zeroes the server's counters so the next read covers only this step. */
  async beginStep(): Promise<void> {
    await this.read(true);
  }

  async endStep(): Promise<ServerStepMetrics | null> {
    const snap = await this.read(false);
    if (!snap) return null;
    return {
      loopP99Ms: snap.eventLoopDelayMs?.p99 ?? null,
      loopMaxMs: snap.eventLoopDelayMs?.max ?? null,
      rssMb: snap.memory.rssMb,
      rooms: snap.rooms,
      clients: snap.clients,
      msgsIn: snap.counters.msgsIn,
      msgsOut: snap.counters.msgsOut,
      bytesOut: snap.counters.bytesOut,
      sendsDropped: snap.counters.sendsDropped,
      flushes: snap.counters.flushes,
      flushedRooms: snap.counters.flushedRooms,
      maxFlushMs: snap.counters.maxFlushMs,
    };
  }
}

/** POST /api/rooms/create, returning the new room id. */
export async function createRoom(target: string): Promise<string> {
  const res = await fetch(new URL("/api/rooms/create", target), { method: "POST" });
  if (res.status === 429) {
    throw new Error(
      "room creation rate-limited (429). Start the server with RATE_LIMIT_ROOM_CREATE set high enough for this run.",
    );
  }
  if (!res.ok) throw new Error(`room create failed: HTTP ${res.status}`);
  const body = (await res.json()) as { roomId?: string };
  if (!body.roomId) throw new Error("room create returned no roomId");
  return body.roomId;
}
