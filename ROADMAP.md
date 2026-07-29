# Roadmap

Where CoChart is headed. The guiding principle is **Excalidraw for markets**:
open, frictionless, and free at the core — open a chart, draw, and share a link,
with no signup and no walls. Contributions toward any of this are welcome — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Recently shipped

- **Frictionless onboarding** — open a chart and draw with no signup, anonymous
  identity by default, one-click shareable invite links, and a first-run welcome
  tour. The path to the first drawing stays zero-friction.
- **Multiple exchanges** — live and historical market data from Coinbase, Kraken,
  and Binance, with no API keys.
- **Technical indicators** — moving averages (SMA/EMA), VWAP, RSI, MACD, and
  volume, configurable and synced live across the room.
- **Richer drawing tools** — text labels and triangles on top of the existing
  trendlines/rays/lines/rectangles/Fibonacci, plus copy/paste, a right-click
  context menu, keyboard shortcuts, and a drawing manager.
- **In-room chat & presence** — live chat, peer cursors, and a presence roster
  alongside the shared drawings.
- **Durable collaborative rooms** — rooms survive brief disconnects (a grace
  period for empty rooms) and full server restarts via server-side SQLite
  persistence, and are reaped after inactivity.
- **Automated tests + CI** — a Vitest suite covering core logic (collab state
  machine, room persistence, market-data batching/caching, parsing, geometry),
  run on every PR via GitHub Actions.
- **Open-sourced charting engine** — the renderer now lives in the standalone
  [`cochart-charts`](https://github.com/0men1/cochart-charts) package.

## Planned

- **Optional cloud saving / support tier** — opt-in accounts for a durable,
  cross-device personal library of charts and drawings, as a way to support the
  project. Distinct from today's anonymous, transient room persistence; explicitly
  *never* a wall on the core experience (the Excalidraw+ model).
- **More drawing tools** — keep expanding the toolset (the drawing manager itself
  has shipped).
- **Improved drawing engine** — continue extending
  [`cochart-charts`](https://github.com/0men1/cochart-charts):
  - Move all drawing definitions out of the app and into `cochart-charts`, so
    they live with the rendering engine rather than in the app.
