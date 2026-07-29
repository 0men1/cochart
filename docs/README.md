# CoChart Architecture

A short tour of how CoChart is put together. For setup instructions see the
[root README](../README.md).

## Overview

CoChart is a single Next.js application served by a custom Node HTTP +
WebSocket server (`server.ts`). The same process serves the React frontend,
REST-style market endpoints, and the collaboration WebSocket, and persists
collaborative-room state to a local SQLite database.

## Data flow

1. **Symbol search** — the client queries `/api/search`; the server’s
   `SearchEngine` (`src/server/market/search.ts`) resolves products indexed
   across the supported exchanges (Coinbase, Kraken, Binance).
2. **Historical candles** — the client requests `/api/candles`; the
   `MarketService` (`src/server/market/service.ts`) fetches from the selected
   exchange’s provider (`CoinbaseProvider`, `KrakenProvider`, or
   `BinanceProvider`), batching requests and caching results in memory
   (`cache.ts`).
3. **Live ticks** — the client subscribes to the selected exchange’s WebSocket
   feed through `src/core/chart/market-data/` and updates the latest candle in
   place.
4. **Collaboration** — rooms are created/joined via `/api/rooms/*`
   (`src/server/collab/routes.ts`). The server holds each room’s authoritative
   state (`Room` / `RoomManager`), and drawing, indicator, chat, cursor, and
   presence updates are broadcast to peers over WebSocket. The wire format is
   defined in [`src/server/collab/protocol.ts`](../src/server/collab/protocol.ts).
5. **Persistence** — your own chart and settings are stored client-side in
   IndexedDB and localStorage (`src/lib/`). Shared **room** state is persisted
   server-side to SQLite via `SqliteRoomStore`
   (`src/server/collab/roomStore.ts`), so rooms survive reconnects and server
   restarts; `RoomManager` flushes changed rooms, restores them on boot, and
   reaps rooms left empty past a grace period. The SQLite file defaults to
   `./data/rooms.db` (`ROOM_DB_PATH`).

## Frontend structure

- `src/app/` — Next.js routes (`/`, `/chart`, `/chart/room/:id`).
- `src/components/chart/` — chart UI and hooks (`useCandleChart`,
  `useChartDrawings`, `useChartInteractions`), plus collaboration UI (chat,
  presence, indicator/drawing managers).
- `src/core/chart/drawings/` — non-React drawing primitives (trendline, ray,
  rectangle, triangle, Fibonacci, text label, horizontal/vertical line) and
  geometry helpers.
- `src/core/chart/indicators/` — indicator definitions and registry (SMA, EMA,
  VWAP, RSI, MACD, volume).
- `src/stores/` — Zustand stores for chart, collaboration, chat, UI, and identity.

## Rendering engine

Charts are rendered by [`cochart-charts`](https://github.com/0men1/cochart-charts),
a separately-maintained fork of TradingView Lightweight Charts™, consumed as an
npm dependency. See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
