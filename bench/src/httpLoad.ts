// The "users not in rooms" scenario.
//
// Every WebSocket connection on this server belongs to a room
// (server/src/collab/routes.ts:51-56 closes the socket when the room does not
// exist), so a user who is not in a room never opens a socket at all. They are
// a pure HTTP load on /api/candles and /api/search, and that is what this
// measures.

import type { RunConfig } from "./config";
import { loopLagP99Ms, startLoopMonitor } from "./eventLoop";
import { Histogram } from "./histogram";
import type { MetricsClient } from "./metricsClient";
import type { StepResult } from "./stats";

/** Matches MAX_CANDLES_PER_REQUEST in server/src/market/service.ts. */
const CANDLES_PER_BLOCK = 300;
const ONE_MINUTE = 60;

const SYMBOLS = [
  { provider: "coinbase", symbol: "BTC-USD" },
  { provider: "coinbase", symbol: "ETH-USD" },
];
const SEARCH_TERMS = ["btc", "eth", "sol", "usd", "ada"];

/**
 * A block-aligned window that ends in the past.
 *
 * Alignment is what keeps this off the exchanges: the server only bypasses its
 * cache for the *trailing partial* block (service.ts:74-88), so a range whose
 * end lands exactly on a block boundary is served entirely from cache once
 * warm. Concurrent misses are additionally coalesced by the single-flight map,
 * so even a cache expiry costs one upstream request, not one per user.
 */
function cachedRange(blocks = 2): { start: number; end: number } {
  const blockDuration = ONE_MINUTE * CANDLES_PER_BLOCK; // 5 hours at 1m
  const nowSec = Math.floor(Date.now() / 1000);
  const end = Math.floor(nowSec / blockDuration) * blockDuration;
  return { start: end - blocks * blockDuration, end };
}

/**
 * A window ending now, so the trailing partial block is refetched upstream on
 * every single request. Only used under --upstream=live.
 */
function liveRange(blocks = 2): { start: number; end: number } {
  const blockDuration = ONE_MINUTE * CANDLES_PER_BLOCK;
  const end = Math.floor(Date.now() / 1000);
  return { start: end - blocks * blockDuration, end };
}

function candlesUrl(cfg: RunConfig): URL {
  const pick = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const range = cfg.upstream === "live" ? liveRange() : cachedRange();
  const url = new URL("/api/candles", cfg.target);
  url.searchParams.set("provider", pick.provider);
  url.searchParams.set("symbol", pick.symbol);
  url.searchParams.set("timeframe", "1m");
  url.searchParams.set("start", String(range.start));
  url.searchParams.set("end", String(range.end));
  return url;
}

function searchUrl(cfg: RunConfig): URL {
  const url = new URL("/api/search", cfg.target);
  url.searchParams.set("q", SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)]);
  url.searchParams.set("l", "20");
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runHttpLevel(
  cfg: RunConfig,
  level: number,
  metrics: MetricsClient,
): Promise<StepResult> {
  const latency = new Histogram();
  const loopDelay = startLoopMonitor();

  let measuring = false;
  let errors = 0;
  let rateLimited = 0;
  let requests = 0;
  let running = true;

  async function once(): Promise<void> {
    const url = Math.random() < cfg.searchRatio ? searchUrl(cfg) : candlesUrl(cfg);
    const startedAt = performance.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      // Body must be drained or the connection is not returned to the pool and
      // the client, not the server, becomes the limit.
      await res.arrayBuffer();
      const elapsed = performance.now() - startedAt;
      if (measuring) {
        requests += 1;
        latency.record(elapsed);
        if (res.status === 429) rateLimited += 1;
        else if (!res.ok) errors += 1;
      }
    } catch {
      if (measuring) errors += 1;
    }
  }

  // One independent loop per virtual user, each pacing itself with think time.
  async function virtualUser(): Promise<void> {
    // Stagger starts so `level` users do not all fire on the same tick.
    await sleep(Math.random() * cfg.thinkSec * 1000);
    while (running) {
      await once();
      if (!running) break;
      // Jittered think time, so the aggregate arrival rate stays smooth.
      await sleep(cfg.thinkSec * 1000 * (0.5 + Math.random()));
    }
  }

  const users = Array.from({ length: level }, () => virtualUser());

  await sleep(cfg.warmupSec * 1000);

  await metrics.beginStep();
  latency.reset();
  loopDelay.reset();
  measuring = true;

  const startedAt = Date.now();
  await sleep(cfg.holdSec * 1000);
  measuring = false;
  const durationMs = Date.now() - startedAt;

  const server = await metrics.endStep();

  running = false;
  await Promise.all(users);
  loopDelay.disable();

  return {
    level,
    users: level,
    rooms: 0,
    latency: latency.summary(),
    // HTTP users never join a room; a 100% rate keeps the SLO check neutral.
    joinsAttempted: 0,
    joinsSucceeded: 0,
    disconnects: 0,
    // 429s count as errors — being rate-limited is a ceiling — but are also
    // reported separately, because it is an artificial one that means the run
    // was misconfigured rather than the server running out of headroom.
    errors: errors + rateLimited,
    rateLimited,
    clientSends: requests,
    generatorLagP99Ms: loopLagP99Ms(loopDelay),
    expectsLatency: true,
    server,
    durationMs,
  };
}
