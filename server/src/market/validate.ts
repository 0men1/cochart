// Input validation for the market endpoints

import { INTERVAL_SECONDS } from "@cochart/protocol";

export const MAX_CANDLES_PER_QUERY = 12_000;
export const MAX_SYMBOL_LENGTH = 25;
export const MAX_QUERY_LENGTH = 100;
export const MAX_SEARCH_LIMIT = 100;

// Symbols differ by exchange: BTC-USD (Coinbase), BTCUSD (Binance.US), Kraken
// pairs. Allow that union without accepting arbitrary input.
const SYMBOL_RE = /^[A-Za-z0-9/_-]+$/;

export interface CandleParams {
  provider: string;
  symbol: string;
  timeframe: string;
  granularity: number;
  start: number;
  end: number;
}

export type CandleValidation =
  | { ok: true; data: CandleParams }
  | { ok: false; error: string };

function parseIntParam(value: string | null): number | null {
  if (value === null || value === "") return 0;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

export function validateCandleParams(
  params: URLSearchParams,
  knownProviders: Set<string>,
  nowSec: number = Math.floor(Date.now() / 1000),
): CandleValidation {
  const symbol = params.get("symbol") ?? "";
  const timeframe = params.get("timeframe") ?? "";
  const provider = params.get("provider") ?? "";

  if (!symbol || !timeframe) {
    return { ok: false, error: "Must include symbol/timeframe" };
  }
  if (symbol.length > MAX_SYMBOL_LENGTH || !SYMBOL_RE.test(symbol)) {
    return { ok: false, error: "Invalid symbol" };
  }

  const granularity = INTERVAL_SECONDS[timeframe];
  if (!granularity) {
    return { ok: false, error: "Unsupported timeframe" };
  }

  if (!knownProviders.has(provider)) {
    return { ok: false, error: "Unknown provider" };
  }

  const start = parseIntParam(params.get("start"));
  const rawEnd = parseIntParam(params.get("end"));
  if (start === null || rawEnd === null || start < 0 || rawEnd < 0) {
    return { ok: false, error: "Invalid start/end" };
  }

  // Clamp a future end down to the current bar — exchanges have no data past
  // now, and an unbounded future end inflates the range cap check below.
  const end = Math.min(rawEnd, nowSec + granularity);
  if (start > end) {
    return { ok: false, error: "start after end" };
  }

  const candleCount = Math.ceil((end - start) / granularity);
  if (candleCount > MAX_CANDLES_PER_QUERY) {
    return { ok: false, error: "Requested range too large" };
  }

  return {
    ok: true,
    data: { provider, symbol, timeframe, granularity, start, end },
  };
}

export interface SearchQuery {
  q: string;
  limit: number;
}

export type SearchValidation =
  | { ok: true; data: SearchQuery }
  | { ok: false; error: string };

export function validateSearchParams(params: URLSearchParams): SearchValidation {
  const q = params.get("q") ?? "";
  const lParam = params.get("l");
  const limit = lParam === null ? Number.NaN : Number.parseInt(lParam, 10);

  if (Number.isNaN(limit)) {
    return { ok: false, error: "Invalid limit" };
  }
  if (q === "") {
    return { ok: false, error: "Must include query" };
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: "Query too long" };
  }

  // Clamp rather than reject: a client asking for too many results just gets
  // the max, not an error.
  const clamped = Math.max(1, Math.min(limit, MAX_SEARCH_LIMIT));
  return { ok: true, data: { q, limit: clamped } };
}
