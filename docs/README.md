# CoChart Architecture

A short tour of how CoChart is put together. For setup instructions see the
[root README](../README.md).

## Overview

CoChart is a single Next.js application (`web/`) served by a custom Node HTTP +
WebSocket server (`web/server.ts`). The same process serves the React frontend,
REST-style market endpoints, and the collaboration WebSocket.

## Data flow

1. **Symbol search** — the client queries `/api/search`; the server’s
   `SearchEngine` (`web/src/server/market/search.ts`) resolves products fetched
   from Coinbase.
2. **Historical candles** — the client requests `/api/candles`; the
   `MarketService` (`web/src/server/market/service.ts`) fetches from Coinbase via
   `CoinbaseProvider`, batching requests and caching results in memory
   (`cache.ts`).
3. **Live ticks** — the client subscribes to Coinbase’s WebSocket feed through
   `web/src/core/chart/market-data/` and updates the latest candle in place.
4. **Collaboration** — rooms are created/joined via `/api/rooms/*`
   (`web/src/server/collab/routes.ts`). Drawing and cursor updates are broadcast
   to peers over WebSocket. The wire format is defined in
   [`web/src/server/collab/protocol.ts`](../web/src/server/collab/protocol.ts).
5. **Persistence** — drawings and settings are stored client-side in IndexedDB
   and localStorage (`web/src/lib/`), so there is no database to run locally.

## Frontend structure

- `web/src/app/` — Next.js routes (`/`, `/chart`, `/chart/room/:id`).
- `web/src/components/chart/` — chart UI and hooks (`useCandleChart`,
  `useChartDrawings`, `useChartInteractions`).
- `web/src/core/chart/drawings/` — non-React drawing primitives (trendline, ray,
  rectangle, Fibonacci, horizontal/vertical line) and geometry helpers.
- `web/src/stores/` — Zustand stores for chart, collaboration, UI, and identity.

## Rendering engine

Charts are rendered by [`cochart-charts`](https://github.com/0men1/cochart-charts),
a separately-maintained fork of TradingView Lightweight Charts™, consumed as an
npm dependency. See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
