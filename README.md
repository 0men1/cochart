# 📈 CoChart — Collaborative Financial Charting Platform

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

*A real-time collaborative financial charting platform with advanced drawing tools and live market data.*

</div>

## What is CoChart?

CoChart lets multiple people analyze markets together on a shared chart in real
time. Open a room, share the link, and everyone sees the same candlesticks,
drawings, and cursors update live.

## Features

- **Live & historical candlesticks** — OHLCV data streamed and backfilled from
  Coinbase's public market API (no API key required).
- **Drawing tools** — trendlines, rays, horizontal & vertical lines, rectangles,
  and Fibonacci retracements, with draggable control points.
- **Real-time collaboration** — WebSocket-backed rooms sync chart state, drawings,
  and peer cursors across participants.
- **Local persistence** — your drawings and settings are saved in the browser via
  IndexedDB, so sessions survive reloads.

## Getting Started

Requirements: **Node.js ≥ 20** and npm.

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000. No API keys or secrets are needed — CoChart uses
Coinbase's public endpoints for market data.

### Scripts (run from `web/`)

| Command         | Description                                        |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Start the dev server (Next.js + WebSocket) on :3000 |
| `npm run build` | Production build                                   |
| `npm run start` | Run the production server                          |
| `npm run lint`  | Lint the codebase                                  |

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, Radix UI
- **State:** Zustand + Immer
- **Realtime:** Custom Node HTTP + WebSocket server (`web/server.ts`, `ws`)
- **Charts:** [`cochart-charts`](https://github.com/0men1/cochart-charts) — a fork
  of TradingView Lightweight Charts™ (see [Credits](#credits))

## Project Layout

```
web/
├── server.ts              # Custom HTTP + WebSocket server (entry point)
└── src/
    ├── app/               # Next.js routes (/, /chart, /chart/room/:id)
    ├── components/        # UI (chart, onboarding, ui primitives)
    ├── core/              # Non-React chart logic (drawings, market data)
    ├── server/            # Backend handlers (market/, collab/)
    ├── stores/            # Zustand stores
    └── lib/               # Utilities (IndexedDB, identity, localStorage)
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
