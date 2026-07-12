# Roadmap

Where CoChart is headed. The guiding principle is **Excalidraw for markets**:
open, frictionless, and free at the core — open a chart, draw, and share a link,
with no signup and no walls. Contributions toward any of this are welcome — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Recently shipped

- **Automated tests + CI** — a Vitest suite covering core logic (collab state
  machine, market-data batching/caching, parsing, geometry), run on every PR via
  GitHub Actions.
- **Open-sourced charting engine** — the renderer now lives in the standalone
  [`cochart-charts`](https://github.com/0men1/cochart-charts) package.

## Planned

- **Frictionless onboarding** — open a chart and draw with no signup; one-click
  shareable invite links; anonymous identity by default. Keeping the path to the
  first drawing zero-friction is the top priority.
- **Optional cloud saving / support tier** — opt-in accounts to persist charts and
  drawings to the cloud, as a way to support the project. Explicitly *never* a wall
  on the core experience (the Excalidraw+ model); local browser persistence stays
  the default.
- **More drawing tools & a drawing manager** — expand the toolset and add a
  list/manager for drawing objects.
- **Improved drawing engine** — continue extending
  [`cochart-charts`](https://github.com/0men1/cochart-charts) for richer dragging
  of drawings and their control points, replacing earlier workarounds.
