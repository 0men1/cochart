# Third-Party Notices

CoChart (the application in this repository) is licensed under the MIT License
(see [`LICENSE`](./LICENSE)). It depends on third-party software with its own
licenses, acknowledged below.

## cochart-charts

CoChart's rendering engine is [`cochart-charts`](https://github.com/0men1/cochart-charts),
a fork of TradingView's Lightweight Charts™ extended with collaborative features,
shapes, and advanced hovering. It is distributed as a separate npm package and
licensed under the **Apache License 2.0**.

- Source: https://github.com/0men1/cochart-charts
- License: Apache-2.0 (see the `LICENSE` and `NOTICE` files in that repository)

### Upstream attribution

> TradingView Lightweight Charts™
> Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/

The Lightweight Charts™ library is a product of TradingView, Inc. and is licensed
under the Apache License 2.0. "TradingView" and "Lightweight Charts" are
trademarks of TradingView, Inc.; their use here is for attribution only and does
not imply endorsement.

## Other dependencies

All remaining runtime and build dependencies are declared in
[`web/package.json`](./web/package.json) and retain their respective open-source
licenses (see each package under `node_modules`).
