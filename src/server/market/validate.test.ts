import { describe, it, expect } from "vitest";
import {
	MAX_CANDLES_PER_QUERY,
	MAX_QUERY_LENGTH,
	MAX_SEARCH_LIMIT,
	MAX_SYMBOL_LENGTH,
	validateCandleParams,
	validateSearchParams,
} from "./validate";

const PROVIDERS = new Set(["coinbase", "kraken", "binance"]);
const NOW = 1_000_000; // fixed clock (unix seconds) for deterministic clamping

function candleParams(overrides: Record<string, string> = {}): URLSearchParams {
	return new URLSearchParams({
		symbol: "BTC-USD",
		timeframe: "1m",
		provider: "coinbase",
		start: "0",
		end: "600",
		...overrides,
	});
}

describe("validateCandleParams", () => {
	it("accepts well-formed params and returns the granularity", () => {
		const result = validateCandleParams(candleParams(), PROVIDERS, NOW);
		expect(result).toEqual({
			ok: true,
			data: {
				provider: "coinbase",
				symbol: "BTC-USD",
				timeframe: "1m",
				granularity: 60,
				start: 0,
				end: 600,
			},
		});
	});

	it("accepts symbol formats used across exchanges", () => {
		for (const symbol of ["BTC-USD", "BTCUSD", "XBT/USD", "XXBTZUSD"]) {
			expect(
				validateCandleParams(candleParams({ symbol }), PROVIDERS, NOW).ok,
			).toBe(true);
		}
	});

	it("rejects a missing symbol or timeframe", () => {
		expect(validateCandleParams(candleParams({ symbol: "" }), PROVIDERS, NOW).ok).toBe(false);
		expect(validateCandleParams(candleParams({ timeframe: "" }), PROVIDERS, NOW).ok).toBe(false);
	});

	it("rejects an invalid or over-long symbol", () => {
		expect(validateCandleParams(candleParams({ symbol: "BTC USD" }), PROVIDERS, NOW).ok).toBe(false);
		expect(validateCandleParams(candleParams({ symbol: "a".repeat(MAX_SYMBOL_LENGTH + 1) }), PROVIDERS, NOW).ok).toBe(false);
	});

	it("rejects an unsupported timeframe", () => {
		expect(validateCandleParams(candleParams({ timeframe: "2m" }), PROVIDERS, NOW).ok).toBe(false);
	});

	it("rejects an unknown provider", () => {
		const result = validateCandleParams(candleParams({ provider: "ftx" }), PROVIDERS, NOW);
		expect(result).toEqual({ ok: false, error: "Unknown provider" });
	});

	it("rejects non-numeric or negative start/end", () => {
		expect(validateCandleParams(candleParams({ start: "abc" }), PROVIDERS, NOW).ok).toBe(false);
		expect(validateCandleParams(candleParams({ start: "-1" }), PROVIDERS, NOW).ok).toBe(false);
	});

	it("rejects start after end", () => {
		const result = validateCandleParams(candleParams({ start: "600", end: "0" }), PROVIDERS, NOW);
		expect(result).toEqual({ ok: false, error: "start after end" });
	});

	it("clamps a future end down to now + one bar", () => {
		const result = validateCandleParams(
			candleParams({ start: String(NOW - 60), end: String(NOW + 999_999) }),
			PROVIDERS,
			NOW,
		);
		expect(result.ok && result.data.end).toBe(NOW + 60);
	});

	it("rejects a range that exceeds the candle cap", () => {
		// 1m candles over (cap + 1) minutes => one candle too many.
		const end = String((MAX_CANDLES_PER_QUERY + 1) * 60);
		const result = validateCandleParams(
			candleParams({ start: "0", end }),
			PROVIDERS,
			// keep NOW past the requested end so it isn't clamped first
			(MAX_CANDLES_PER_QUERY + 100) * 60,
		);
		expect(result).toEqual({ ok: false, error: "Requested range too large" });
	});

	it("allows a range exactly at the candle cap", () => {
		const end = String(MAX_CANDLES_PER_QUERY * 60);
		const result = validateCandleParams(
			candleParams({ start: "0", end }),
			PROVIDERS,
			(MAX_CANDLES_PER_QUERY + 100) * 60,
		);
		expect(result.ok).toBe(true);
	});
});

describe("validateSearchParams", () => {
	function searchParams(overrides: Record<string, string> = {}): URLSearchParams {
		return new URLSearchParams({ q: "btc", l: "10", ...overrides });
	}

	it("accepts a well-formed query", () => {
		expect(validateSearchParams(searchParams())).toEqual({
			ok: true,
			data: { q: "btc", limit: 10 },
		});
	});

	it("rejects a missing/non-numeric limit", () => {
		expect(validateSearchParams(new URLSearchParams({ q: "btc" })).ok).toBe(false);
		expect(validateSearchParams(searchParams({ l: "abc" })).ok).toBe(false);
	});

	it("rejects an empty query", () => {
		expect(validateSearchParams(searchParams({ q: "" })).ok).toBe(false);
	});

	it("rejects an over-long query", () => {
		expect(validateSearchParams(searchParams({ q: "a".repeat(MAX_QUERY_LENGTH + 1) })).ok).toBe(false);
	});

	it("clamps the limit into [1, max]", () => {
		const low = validateSearchParams(searchParams({ l: "0" }));
		const high = validateSearchParams(searchParams({ l: "5000" }));
		expect(low.ok && low.data.limit).toBe(1);
		expect(high.ok && high.data.limit).toBe(MAX_SEARCH_LIMIT);
	});
});
