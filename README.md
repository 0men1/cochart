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
  Coinbase's public market API (no API key required).
- **Drawing tools** — trendlines, rays, horizontal & vertical lines, rectangles,
  and Fibonacci retracements, with draggable control points.
- **Real-time collaboration** — WebSocket-backed rooms sync chart state, drawings,
  and peer cursors across participants.
- **Local persistence** — drawings and settings are saved in your browser via
  IndexedDB, so sessions survive reloads (opt-in cloud saving is planned).

## Getting Started

Requirements: **Node.js ≥ 20** and npm.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No API keys or secrets are needed — CoChart uses
Coinbase's public endpoints for market data.

### Scripts

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
- **Realtime:** Custom Node HTTP + WebSocket server (`server.ts`, `ws`)
- **Charts:** [`cochart-charts`](https://github.com/0men1/cochart-charts) — a fork
  of TradingView Lightweight Charts™ (see [Credits](#credits))

## Project Layout

```
├── server.ts              # Custom HTTP + WebSocket server (entry point)
├── next.config.ts         # Next.js config
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
