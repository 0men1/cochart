# 📈 CoChart — Collaborative Financial Charting Platform

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

*Open-source, real-time collaborative market charting — open a chart, draw, and share a link. No signup, no walls.*

</div>

> **Project status:** early-stage and actively developed (pre-1.0). Contributions and feedback welcome.

## What is CoChart?

CoChart is an open-source, Excalidraw-style tool for markets: open a chart and
start drawing instantly — no account required — then share a link and everyone
in the room sees the same candlesticks, drawings, and cursors update live.

You're anonymous by default and nothing gets in your way before the first
drawing. **The core is free and open forever;** cloud saving is a planned,
optional way to support the project — never a gate on what CoChart already does.

## Features

- **Free & open source (MIT)** — self-host it, fork it, or just use it; the core
  has no paywalls.
- **No signup** — anonymous by default. Start drawing instantly and invite others
  with a link.
- **Live & historical candlesticks** — OHLCV data streamed and backfilled from
  public exchange APIs — **Coinbase, Kraken, and Binance** — with no API keys
  required.
- **Drawing tools** — trendlines, rays, horizontal & vertical lines, rectangles,
  triangles, Fibonacci retracements, and text labels, with draggable control
  points, copy/paste, a right-click context menu, keyboard shortcuts, and a
  drawing manager.
- **Technical indicators** — moving averages (SMA/EMA), VWAP, RSI, MACD, and
  volume, each configurable and synced live across the room.
- **Real-time collaboration** — WebSocket-backed rooms sync chart state, drawings,
  indicators, peer cursors, live presence, and in-room chat. Rooms survive brief
  disconnects and server restarts (a short grace period plus server-side
  persistence) and are cleaned up automatically after everyone leaves.
- **Persistence** — your own chart and settings are saved locally in your browser
  (IndexedDB); shared rooms are persisted server-side (SQLite) so they survive
  reconnects and restarts, then reaped after inactivity. Opt-in cloud accounts
  for a durable personal library are planned.

## Getting Started

Requirements: **Node.js ≥ 20** and npm.

```bash
npm install
npm run dev
```

`npm run dev` runs both workspaces together (via `concurrently`): the Next.js web
app on **:3000** and the API + WebSocket server on **:4000**. Then open
http://localhost:3000. No API keys or secrets are needed — CoChart uses public
exchange endpoints (Coinbase, Kraken, Binance) for market data.

On first run the server creates a small SQLite file for collaborative-room
persistence at `./data/rooms.db` (override with `ROOM_DB_PATH`). It's git-ignored,
and no external database is required.

### Scripts

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start web (:3000) + API/WebSocket server (:4000)     |
| `npm run build`     | Production build (web static export)                 |
| `npm run start:api` | Run the API/WebSocket server                         |
| `npm run lint`      | Lint the web codebase                                |
| `npm run typecheck` | Type-check every workspace                           |
| `npm run test`      | Run the test suite (Vitest)                          |

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, Radix UI
- **State:** Zustand + Immer
- **Realtime:** Custom Node HTTP + WebSocket server (`server/src/index.ts`, `ws`)
- **Market data:** public REST + WebSocket feeds from Coinbase, Kraken, and
  Binance (no API keys)
- **Persistence:** SQLite (`better-sqlite3`) for collaborative-room state;
  IndexedDB + localStorage in the browser for local chart/settings
- **Charts:** [`cochart-charts`](https://github.com/0men1/cochart-charts) — a fork
  of TradingView Lightweight Charts™ (see [Credits](#credits))

## Project Layout

CoChart is an npm-workspaces monorepo:

```
├── web/                   # Next.js frontend (static export)
│   └── src/
│       ├── app/           # Next.js routes (/, /chart, /chart/room/:id)
│       ├── components/    # UI (chart, onboarding, ui primitives)
│       ├── core/          # Non-React chart logic (drawings, market data)
│       ├── stores/        # Zustand stores
│       └── lib/           # Utilities (IndexedDB, identity, localStorage)
├── server/                # Node HTTP + WebSocket API server
│   └── src/
│       ├── index.ts       # Entry point
│       ├── market/        # /api market endpoints (candles, search)
│       └── collab/        # Rooms, presence, SQLite persistence
└── packages/
    └── protocol/          # Wire types + logger shared by web and server
```

See [`docs/`](./docs) for an architecture overview.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md) before opening a pull request. Planned work
lives in [ROADMAP.md](./ROADMAP.md).

## License

MIT © 2026 0men1 — see [LICENSE](./LICENSE).

## Credits

Charting is powered by [`cochart-charts`](https://github.com/0men1/cochart-charts),
a fork of [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts)
(Apache-2.0). See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for full
attribution.
