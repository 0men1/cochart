import { describe, it, expect, beforeEach } from "vitest";
import { DrawingType } from "@/core/chart/types";
import {
	getLastDrawingOptions,
	rememberDrawingOptions,
	__resetDrawingDefaultsCache,
} from "./drawingDefaults";

beforeEach(() => {
	__resetDrawingDefaultsCache();
});

describe("drawing defaults", () => {
	it("returns undefined for a type that was never customised", () => {
		expect(getLastDrawingOptions(DrawingType.TREND_LINE)).toBeUndefined();
	});

	it("remembers the last options applied to a type", () => {
		rememberDrawingOptions(DrawingType.TREND_LINE, { color: "#ff0000", width: 3 });
		expect(getLastDrawingOptions(DrawingType.TREND_LINE)).toEqual({
			color: "#ff0000",
			width: 3,
		});
	});

	it("overwrites earlier options for the same type", () => {
		rememberDrawingOptions(DrawingType.TREND_LINE, { color: "#ff0000", width: 3 });
		rememberDrawingOptions(DrawingType.TREND_LINE, { color: "#00ff00", width: 1 });
		expect(getLastDrawingOptions(DrawingType.TREND_LINE)).toEqual({
			color: "#00ff00",
			width: 1,
		});
	});

	it("keeps types independent of one another", () => {
		rememberDrawingOptions(DrawingType.TREND_LINE, { color: "#ff0000" });
		rememberDrawingOptions(DrawingType.RECTANGLE, { fillColor: "#0000ff" });
		expect(getLastDrawingOptions(DrawingType.TREND_LINE)).toEqual({ color: "#ff0000" });
		expect(getLastDrawingOptions(DrawingType.RECTANGLE)).toEqual({ fillColor: "#0000ff" });
	});

	it("strips per-drawing keys (label text) so they don't leak to new drawings", () => {
		rememberDrawingOptions(DrawingType.TREND_LINE, {
			color: "#ff0000",
			labelText: "support",
			showLabel: true,
		});
		expect(getLastDrawingOptions(DrawingType.TREND_LINE)).toEqual({ color: "#ff0000" });
	});
});
