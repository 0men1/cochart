import { describe, it, expect } from "vitest";
import { SearchEngine } from "./search";
import type { Candlestick, ExchangeProvider, Product } from "./types";

function product(name: string): Product {
	return { id: name.toLowerCase(), name, type: "spot", exchange: "test" };
}

function provider(id: string, products: Product[], fail = false): ExchangeProvider {
	return {
		id: () => id,
		fetchCandles: async (): Promise<Candlestick[]> => [],
		getProducts: async (): Promise<Product[]> => {
			if (fail) throw new Error("provider unavailable");
			return products;
		},
	};
}

// Product names are stored/compared as-is (the engine only upper-cases the
// query), and real exchange symbols are upper-case, so the fixtures are too.
async function buildEngine(
	providers: Map<string, ExchangeProvider>,
): Promise<SearchEngine> {
	const engine = new SearchEngine();
	await engine.buildIndex(providers);
	return engine;
}

describe("SearchEngine", () => {
	const providers = new Map<string, ExchangeProvider>([
		["coinbase", provider("coinbase", [product("BTC-USD"), product("ETH-USD"), product("ETH-EUR")])],
		["other", provider("other", [product("ADA-USD"), product("SOL-USD")])],
	]);

	it("returns prefix matches in alphabetical order", async () => {
		const engine = await buildEngine(providers);
		expect(engine.search("ETH", 10).map((p) => p.name)).toEqual(["ETH-EUR", "ETH-USD"]);
	});

	it("respects the result limit", async () => {
		const engine = await buildEngine(providers);
		expect(engine.search("ETH", 1).map((p) => p.name)).toEqual(["ETH-EUR"]);
	});

	it("is case-insensitive (query is upper-cased)", async () => {
		const engine = await buildEngine(providers);
		expect(engine.search("btc", 10).map((p) => p.name)).toEqual(["BTC-USD"]);
	});

	it("returns an empty array for an empty query", async () => {
		const engine = await buildEngine(providers);
		expect(engine.search("", 10)).toEqual([]);
	});

	it("returns an empty array when nothing matches", async () => {
		const engine = await buildEngine(providers);
		expect(engine.search("XRP", 10)).toEqual([]);
	});

	it("skips providers that fail to load", async () => {
		const withFailing = new Map<string, ExchangeProvider>([
			["coinbase", provider("coinbase", [product("BTC-USD")])],
			["broken", provider("broken", [], true)],
		]);
		const engine = await buildEngine(withFailing);
		// The failing provider does not abort indexing; the healthy one still works.
		expect(engine.search("BTC", 10).map((p) => p.name)).toEqual(["BTC-USD"]);
	});
});
