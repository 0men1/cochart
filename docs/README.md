# CoChart Architecture

A short tour of how CoChart is put together. For setup instructions see the
[root README](../README.md).

## Overview

CoChart is an npm-workspaces monorepo with two deployables and one shared
package:

- **`web/`** — the Next.js frontend, built as a static export (`output: "export"`)
  and hosted on its own (e.g. Vercel).
- **`server/`** — a custom Node HTTP + WebSocket server that serves the REST-style
  market endpoints and the collaboration WebSocket, and persists room state to a
  local SQLite database.
- **`packages/protocol/`** — the collaboration wire protocol, shared market wire
  types, and an isomorphic logger imported by both sides.

In production the web app and the API server run as **separate processes**; the
static site proxies `/api/*` to the server's host (see `vercel.json`). In
development `npm run dev` runs both together (web on :3000, server on :4000).

## Data flow

1. **Symbol search** — the client queries `/api/search`; the server’s
   `SearchEngine` (`server/src/market/search.ts`) resolves products indexed
   across the supported exchanges (Coinbase, Kraken, Binance).
2. **Historical candles** — the client requests `/api/candles`; the
   `MarketService` (`server/src/market/service.ts`) fetches from the selected
   exchange’s provider (`CoinbaseProvider`, `KrakenProvider`, or
   `BinanceProvider`), batching requests and caching results in memory
   (`cache.ts`).
3. **Live ticks** — the client subscribes to the selected exchange’s WebSocket
   feed **directly** through `web/src/core/chart/market-data/` (the server is not
   in this path) and updates the latest candle in place.
4. **Collaboration** — rooms are created/joined via `/api/rooms/*`
   (`server/src/collab/routes.ts`). The server holds each room’s authoritative
   state (`Room` / `RoomManager`), and drawing, indicator, chat, cursor, and
   presence updates are broadcast to peers over WebSocket. The wire format is
   defined in [`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts).
5. **Persistence** — your own chart and settings are stored client-side in
   IndexedDB and localStorage (`web/src/lib/`). Shared **room** state is persisted
   server-side to SQLite via `SqliteRoomStore`
   (`server/src/collab/roomStore.ts`), so rooms survive reconnects and server
   restarts; `RoomManager` flushes changed rooms, restores them on boot, and
   reaps rooms left empty past a grace period. The SQLite file defaults to
   `./data/rooms.db` (`ROOM_DB_PATH`).

## Frontend structure

- `web/src/app/` — Next.js routes (`/`, `/chart`, `/chart/room/:id`).
- `web/src/components/chart/` — chart UI and hooks (`useCandleChart`,
  `useChartDrawings`, `useChartInteractions`), plus collaboration UI (chat,
  presence, indicator/drawing managers).
- `web/src/core/chart/drawings/` — non-React drawing primitives (trendline, ray,
  rectangle, triangle, Fibonacci, text label, horizontal/vertical line) and
  geometry helpers.
- `web/src/core/chart/indicators/` — indicator definitions and registry (SMA, EMA,
  VWAP, RSI, MACD, volume).
- `web/src/stores/` — Zustand stores for chart, collaboration, chat, UI, and identity.

## Rendering engine

Charts are rendered by [`cochart-charts`](https://github.com/0men1/cochart-charts),
a separately-maintained fork of TradingView Lightweight Charts™, consumed as an
npm dependency. See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
