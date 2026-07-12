# Contributing to CoChart

Thanks for your interest in improving CoChart! This guide covers how to get set up
and how to propose changes.

## Development setup

Requirements: **Node.js ≥ 20** and npm.

```bash
git clone https://github.com/0men1/cochart.git
cd cochart
npm install
npm run dev        # http://localhost:3000
```

No API keys or secrets are required — CoChart uses Coinbase's public market data
endpoints.

## Making changes

1. **Fork** the repository and create a branch off `master`
   (e.g. `fix/drawing-snap`, `feat/exchange-adapter`).
2. Make your change. Keep pull requests focused — one logical change per PR.
3. **Lint before pushing:**
   ```bash
   npm run lint
   ```
4. Verify the app still builds and runs:
   ```bash
   npm run build && npm run dev
   ```
5. Open a pull request describing **what** changed and **why**.

## Commit messages

Write clear, imperative commit messages that explain the change
(e.g. `Fix duplicate drawings when switching series`). Small, descriptive commits
are easier to review than one large batch.

## The charts engine

The rendering engine lives in a separate repository,
[`cochart-charts`](https://github.com/0men1/cochart-charts), and is consumed here as
an npm dependency. Changes to drawing/rendering internals belong in that repo; this
repo consumes the published package.

## Reporting issues

Please file bugs and feature requests via
[GitHub Issues](https://github.com/0men1/cochart/issues). For bugs, include steps to
reproduce, the symbol/room involved, and your browser/OS.

## Tests

There is no automated test suite yet — adding one is on the [roadmap](./ROADMAP.md).
Until then, please manually verify affected flows and note what you tested in your PR.
