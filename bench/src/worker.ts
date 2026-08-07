// A worker thread owning a slice of the virtual users.
//
// Everything here is shaped by one constraint: the generator must stay far
// cheaper per message than the server, or we end up measuring the harness. That
// drives three choices — no per-client timers (one shared tick loop instead),
// no full JSON.parse on the receive path, and no per-sample postMessage.

import { parentPort, workerData } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { CollabAction } from "@cochart/protocol";
import { loopLagP99Ms, startLoopMonitor } from "./eventLoop";
import { Histogram } from "./histogram";
import type { Assignment, WorkerConfig, WorkerToMain, MainToWorker } from "./protocol";

const cfg = workerData as WorkerConfig;
const port = parentPort;
if (!port) throw new Error("worker.ts must be run as a worker thread");

/**
 * Wall-clock milliseconds at high resolution. `timeOrigin` differs per thread
 * but is itself epoch-anchored, so the sum is directly comparable between the
 * sending worker and the receiving one.
 */
const nowMs = () => performance.timeOrigin + performance.now();

// The stamp is the last key in the cursor payload, so lastIndexOf finds it
// after a handful of bytes rather than scanning the whole frame.
const STAMP_KEY = '"__t":';
const STAMP_MARKER = Buffer.from(STAMP_KEY);

/**
 * Pulls the send timestamp out of a relayed cursor frame without parsing it.
 *
 * At N users in a room the harness receives N*(N-1)*cursorHz frames per second;
 * full JSON.parse at that rate saturates the worker long before the server is
 * in trouble. Frames without the marker (presence, snapshot, chat) return -1
 * and are skipped, which doubles as the message-type filter.
 */
function stampOf(buf: Buffer): number {
  const at = buf.lastIndexOf(STAMP_MARKER);
  if (at < 0) return -1;
  const from = at + STAMP_MARKER.length;
  // A float is at most ~18 chars; parseFloat stops at the first non-numeric
  // byte, so trailing JSON in the slice is harmless.
  const value = Number.parseFloat(buf.toString("latin1", from, Math.min(from + 24, buf.length)));
  return Number.isFinite(value) ? value : -1;
}

interface VirtualUser {
  ws: WebSocket;
  userId: string;
  roomId: string;
  open: boolean;
  /** Duty-cycle state: whether this user is currently moving their cursor. */
  active: boolean;
  /** Set once the socket opens, so we only count post-join disconnects. */
  joined: boolean;
}

const users: VirtualUser[] = [];
const latency = new Histogram();
const loopDelay = startLoopMonitor();

let joinsAttempted = 0;
let joinsSucceeded = 0;
let disconnects = 0;
let errors = 0;
let clientSends = 0;
/** Gates measurement so warmup traffic never lands in the histogram. */
let measuring = false;

function send(user: VirtualUser, payload: string): void {
  if (!user.open) return;
  try {
    user.ws.send(payload);
    clientSends += 1;
  } catch {
    errors += 1;
  }
}

function cursorFrame(user: VirtualUser): string {
  // Mirrors the real client's payload (useCollabStore.broadcastCursor) plus the
  // timestamp the receiving side reads back out.
  return `{"type":"${CollabAction.CURSOR}","payload":{"userId":"${user.userId}","time":${
    Math.floor(Date.now() / 1000)
  },"price":${(50_000 + Math.random() * 1000).toFixed(2)},"hidden":false,"__t":${nowMs()}}}`;
}

function drawingFrame(user: VirtualUser): string {
  // A trendline-shaped payload. Drawing edits are what mark a room dirty and
  // therefore what drives the synchronous SQLite flush.
  const point = () => ({
    time: Math.floor(Date.now() / 1000),
    price: Number((50_000 + Math.random() * 1000).toFixed(2)),
  });
  return JSON.stringify({
    type: CollabAction.MODIFY_DRAWING,
    payload: {
      drawing: {
        // Cycled over a small id space so a user edits existing drawings rather
        // than growing the room past MAX_DRAWINGS and being silently dropped.
        id: `${user.userId}-${Math.floor(Math.random() * 20)}`,
        kind: "trendline",
        points: [point(), point()],
        color: "#3b82f6",
        width: 2,
      },
    },
  });
}

function chatFrame(): string {
  return JSON.stringify({
    type: CollabAction.CHAT,
    payload: { text: `bench message ${Math.random().toString(36).slice(2, 10)}` },
  });
}

function seedFrame(): string {
  return JSON.stringify({
    type: CollabAction.INIT_ROOM,
    payload: {
      product: { ID: "BTC-USD", Name: "Bitcoin", Exchange: "coinbase" },
      timeframe: "1m",
      drawings: [],
      indicators: [],
    },
  });
}

function connect(roomId: string, seed: boolean): Promise<void> {
  return new Promise((resolve) => {
    const userId = randomUUID();
    const url = `${cfg.wsTarget}/api/rooms/join?roomId=${encodeURIComponent(roomId)}&userId=${userId}&displayName=bench&color=%233b82f6`;
    const ws = new WebSocket(url, { perMessageDeflate: false });
    const user: VirtualUser = { ws, userId, roomId, open: false, active: false, joined: false };
    users.push(user);
    joinsAttempted += 1;

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    ws.on("open", () => {
      user.open = true;
      user.joined = true;
      joinsSucceeded += 1;
      if (seed) send(user, seedFrame());
      settle();
    });

    ws.on("message", (data: Buffer) => {
      if (!measuring) return;
      const stamp = stampOf(data);
      if (stamp > 0) latency.record(nowMs() - stamp);
    });

    ws.on("close", () => {
      user.open = false;
      // A close before "open" is a rejected join, already counted by the
      // attempted/succeeded gap; only count losses of an established session.
      if (user.joined) disconnects += 1;
      settle();
    });

    ws.on("error", () => {
      errors += 1;
      user.open = false;
      settle();
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connectAll(assignments: Assignment[]): Promise<void> {
  // Spread connects over time: slamming thousands of sockets at once overflows
  // the accept backlog and measures the listen queue rather than the hub.
  const gapMs = 1000 / Math.max(1, cfg.connectRatePerSec);
  const pending: Promise<void>[] = [];
  for (const a of assignments) {
    for (let i = 0; i < a.users; i++) {
      pending.push(connect(a.roomId, a.seed && i === 0));
      if (gapMs > 0) await sleep(gapMs);
    }
  }
  await Promise.all(pending);
}

let cursorTimer: NodeJS.Timeout | null = null;
let slowTimer: NodeJS.Timeout | null = null;

function startTraffic(): void {
  if (cfg.silent) return;

  // One shared tick for every user this worker owns. Thousands of individual
  // per-user timers would cost more than the sends themselves.
  const periodMs = 1000 / cfg.cursorHz;
  const ticksPerReroll = Math.max(1, Math.round(2000 / periodMs)); // ~2s bursts
  let tick = 0;

  cursorTimer = setInterval(() => {
    tick += 1;
    const reroll = tick % ticksPerReroll === 0;
    for (const user of users) {
      if (!user.open) continue;
      // Re-rolled periodically rather than per tick, so users move in bursts
      // like real ones instead of flickering on and off at 25 Hz.
      if (reroll) user.active = Math.random() < cfg.duty;
      if (user.active) send(user, cursorFrame(user));
    }
  }, periodMs);

  slowTimer = setInterval(() => {
    const drawP = cfg.drawEditsPerMin / 60;
    const chatP = cfg.chatPerMin / 60;
    for (const user of users) {
      if (!user.open) continue;
      if (Math.random() < drawP) send(user, drawingFrame(user));
      if (Math.random() < chatP) send(user, chatFrame());
    }
  }, 1000);
}

function digest(): WorkerToMain {
  return {
    type: "digest",
    latency: latency.toData(),
    joinsAttempted,
    joinsSucceeded,
    disconnects,
    errors,
    clientSends,
    loopP99Ms: loopLagP99Ms(loopDelay),
    openSockets: users.reduce((n, u) => n + (u.open ? 1 : 0), 0),
  };
}

function resetCounters(): void {
  latency.reset();
  loopDelay.reset();
  disconnects = 0;
  errors = 0;
  clientSends = 0;
}

port.on("message", async (msg: MainToWorker) => {
  switch (msg.type) {
    case "connect":
      await connectAll(msg.assignments);
      startTraffic();
      port.postMessage({ type: "connected", joinsAttempted, joinsSucceeded, errors });
      break;

    case "measure":
      // Reset first, then open the gate, so nothing from warmup is counted.
      resetCounters();
      measuring = true;
      port.postMessage({ type: "measuring" });
      break;

    case "collect":
      measuring = false;
      port.postMessage(digest());
      break;

    case "stop":
      if (cursorTimer) clearInterval(cursorTimer);
      if (slowTimer) clearInterval(slowTimer);
      for (const user of users) {
        user.joined = false; // teardown closes are expected, not disconnects
        try {
          user.ws.close();
        } catch {
          // already gone
        }
      }
      port.postMessage({ type: "stopped" });
      break;
  }
});
