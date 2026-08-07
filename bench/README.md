# CoChart capacity harness

Answers three questions with numbers instead of guesses:

1. How many users can we carry **not in rooms**?
2. How many users can we carry **in a single room**?
3. How many **rooms at full occupancy** can we carry?

## Quick start

The server needs `METRICS_ENABLED=1` for the harness to see event-loop data, and
its per-IP rate limits raised, since all load arrives from one address.

```bash
# Terminal 1 — server under test
METRICS_ENABLED=1 PORT=4100 NODE_ENV=production \
  RATE_LIMIT_ROOM_CREATE=1000000 RATE_LIMIT_CANDLES=1000000 RATE_LIMIT_SEARCH=1000000 \
  npx tsx server/src/index.ts

# Terminal 2 — find the single-room limit
npm run bench -- single-room --ramp --target http://localhost:4100
```

`npm run bench -- --help` lists every option.

For numbers you intend to quote, run the server in a container pinned to
production-like resources instead — see `docker-compose.bench.yml`.

## Scenarios

| Scenario | Answers | What it drives |
| --- | --- | --- |
| `http` | users **not** in rooms | `/api/candles` + `/api/search`; no WebSocket at all |
| `idle-ws` | connection capacity | sockets held open and silent |
| `single-room` | users in one room | N users at 25 Hz cursors — the O(N²) case |
| `many-rooms` | rooms at occupancy | R rooms × N users, plus SQLite flush pressure |

Why `http` has no WebSocket: every connection on this server belongs to a room —
`handleJoinRoom` (`server/src/collab/routes.ts:51-56`) closes the socket with
code 1008 when the room does not exist. A user who is not in a room never opens
one, so "users not in rooms" is purely an HTTP question.

## How capacity is defined

The highest level that holds all of the following through a measured steady
state after warmup:

| Signal | Default budget |
| --- | --- |
| p95 fan-out latency | ≤ 150 ms |
| p99 fan-out latency | ≤ 400 ms |
| server event-loop p99 | ≤ 100 ms |
| worst single event-loop stall | ≤ 1000 ms |
| join success | 100% |
| dropped sends / disconnects | 0 |

The headline measurement is **end-to-end fan-out latency**: one client stamps a
high-resolution timestamp into its cursor payload and a peer computes the delta
on receipt. Generator and server share a clock, so there is no skew. This is
what a user actually perceives as lag.

Event-loop delay is the explanatory variable. The server is single-threaded: once
the loop falls behind, every client lags regardless of which room they are in.
Both p99 *and* max are checked, because a server frozen for 50 seconds fires its
sampler only a handful of times and the freeze gets diluted out of a p99.

### When the harness does not trust itself

Two guards mark a step `INVALID` rather than letting it masquerade as a server
limit:

- **Generator saturation.** Each worker measures its own event-loop lag. Lag adds
  directly to every sample that worker takes, so past a threshold the numbers
  describe the harness, not the server.
- **Ephemeral port exhaustion.** Every outbound connection to the same
  `host:port` needs a distinct local source port, and the range is finite —
  16,384 by default on macOS. Join failures near that ceiling are the harness
  running out of ports.

`INVALID` is deliberately separate from `FAIL`. A contaminated step contains no
information; treating it as "capacity reached" would understate the server.

## Results

Measured 2026-08-03 against an **unrestricted local process** (Node 25, 10-core
M-series, server single-threaded so effectively 1 core).

> These are **upper bounds, not production capacity.** A small cloud VM will land
> materially lower. Re-run via `docker-compose.bench.yml` with limits matching
> your host before quoting anything. Docker was not running when these were
> taken, so the prod-matched pass is still outstanding.

| Scenario | Result | Notes |
| --- | --- | --- |
| `http` | **≥ 6,400 users** (~1,280 req/s) | Never degraded — p95 flat at 3 ms from 100 to 6,400 users; hit the configured ramp ceiling, not a limit |
| `idle-ws` | **≥ 16,000 connections** | Harness-limited by ephemeral ports, *not* a server limit. RSS ~178 MB at 10k connections |
| `single-room` | **110 users** | Breaks at 120 |
| `many-rooms` | **640 rooms × 8 users** = 5,120 users | Breaks at 1,280 rooms |

### The three limits are one limit

Both collaboration scenarios break at the same server-wide fan-out rate:

- single-room: 110 × 109 peers × 25 Hz × 1.0 duty ≈ **295k sends/s**
- many-rooms: 640 × 8 × 7 peers × 25 Hz × 0.3 duty ≈ **268k sends/s**

So the real capacity number is **~270–300k WebSocket sends per second**, and
every other figure is derived from it. Capacity in users depends entirely on how
those users are arranged: fan-out cost is `users × (peers per room)`, so one room
of 110 costs the same as 640 rooms of 8.

**Users not in rooms are essentially free.** The HTTP path showed no degradation
at all across a 64× range. The constraint is the WebSocket hub, exclusively.

### Failure is a cliff, not a slope

| users in one room | p95 |
| --- | --- |
| 80 | 16 ms |
| 110 | 33 ms |
| 120 | 964 ms |
| 160 | 16,926 ms |

Between 110 and 120 users, p95 degrades 29×. At 160 it is nearly 17 seconds.
There is no graceful degradation band: the room is fine, and then it is unusable.

At 1,280 rooms (10,240 connections) the server stopped answering HTTP entirely
for ~50 seconds while RSS jumped 178 MB → 455 MB, then recovered once clients
disconnected. It did not crash, and it logged nothing.

### Bottlenecks this exposes

Ranked by what the measurements actually support:

1. **Unbatched O(N) fan-out** — `Room.broadcastToOthers`
   (`server/src/collab/room.ts:270`) writes one frame per peer per message, with
   no coalescing across the 40 ms cursor window. This is the binding constraint
   in every collaboration scenario.
2. **No send backpressure** — `Client.send` (`client.ts:28`) checks
   `readyState` but never `bufferedAmount`, so a slow consumer buffers without
   bound. The 178 → 455 MB spike is consistent with this.
3. **Synchronous SQLite flush** — `flushDirty` (`roomManager.ts:42`) blocks the
   event loop for every dirty room. Measured up to 57 ms at 2,000 rooms. Not the
   binding constraint yet, but it grows with room count and stalls *all* clients.
4. **O(N²) presence on join** — `Room.register` (`room.ts:93`) rebuilds and
   broadcasts the full roster per join, so a herd of N arrivals is O(N²) before
   anyone draws anything.
5. **Historical candles cached for only 5 minutes** — full blocks are immutable
   once closed, so the TTL in `market/cache.ts:12` forces avoidable refetches.

None of these are fixed; this pass was measurement only.

## Safety

**`--upstream=live` hits real exchanges.** The trailing partial candle block
bypasses both the cache and single-flight coalescing
(`server/src/market/service.ts:74-88`), so every virtual user produces a real
request to Coinbase/Binance. Sustained runs risk getting the server's IP
rate-limited or banned. The default `--upstream=cached` uses block-aligned
historical ranges that stay in cache, which measures CoChart's own serving
capacity and leaves the exchanges alone.

**Never point this at production.** Use a staging deploy or the local container.

## Interpreting a run

- `fanout` should equal peers-per-room (N−1 for one room). If it does not, the
  traffic model is not doing what you think.
- `out/s` is the number that actually matters — see above.
- `loop p99` near zero while latency climbs means the bottleneck is *not* server
  CPU; suspect the network path or the harness.
- A `-` in the server columns means `/api/metrics` did not answer for that step,
  which at high load is usually itself the finding.
