import { describe, it, expect } from "vitest";
import { dashPattern } from "./lineStyle";

describe("dashPattern", () => {
	it("returns an empty pattern for solid (and unset)", () => {
		expect(dashPattern("solid", 2)).toEqual([]);
		expect(dashPattern(undefined, 2)).toEqual([]);
	});

	it("scales the dashed pattern with line width", () => {
		expect(dashPattern("dashed", 1)).toEqual([4, 3]);
		expect(dashPattern("dashed", 2)).toEqual([8, 6]);
	});

	it("scales the dotted pattern with line width", () => {
		expect(dashPattern("dotted", 1)).toEqual([1, 2]);
		expect(dashPattern("dotted", 3)).toEqual([3, 6]);
	});

	it("treats a zero/negative width as 1 so the pattern is never degenerate", () => {
		expect(dashPattern("dashed", 0)).toEqual([4, 3]);
		expect(dashPattern("dotted", -5)).toEqual([1, 2]);
	});
});
