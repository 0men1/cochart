import { describe, expect, it } from "vitest";
import { deepMerge } from "./mergeSettings";

describe("deepMerge", () => {
	it("returns defaults when override is empty", () => {
		const base = { a: 1, b: { c: 2 } };
		expect(deepMerge(base, {})).toEqual({ a: 1, b: { c: 2 } });
	});

	it("overrides primitive values present in override", () => {
		const base = { a: 1, b: 2 };
		expect(deepMerge(base, { a: 9 })).toEqual({ a: 9, b: 2 });
	});

	it("fills in newly added nested fields from base defaults", () => {
		// Simulates persisted state that predates a new `style` field.
		const base = { grid: { visible: true, color: "#fff", style: 0 } };
		const persisted = { grid: { visible: false, color: "#000" } };
		expect(deepMerge(base, persisted)).toEqual({
			grid: { visible: false, color: "#000", style: 0 },
		});
	});

	it("drops stale keys that no longer exist in base", () => {
		const base = { a: 1 };
		const persisted = { a: 2, removed: 3 };
		expect(deepMerge(base, persisted)).toEqual({ a: 2 });
		expect(deepMerge(base, persisted)).not.toHaveProperty("removed");
	});

	it("does not mutate the base object", () => {
		const base = { a: 1, b: { c: 2 } };
		const copy = structuredClone(base);
		deepMerge(base, { b: { c: 5 } });
		expect(base).toEqual(copy);
	});

	it("falls back to base when override is undefined", () => {
		expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
	});

	it("takes override wholesale when base leaf is a primitive", () => {
		// A nested object in override replacing a primitive default still wins.
		expect(deepMerge({ a: 1 }, { a: { nested: true } })).toEqual({
			a: { nested: true },
		});
	});
});
