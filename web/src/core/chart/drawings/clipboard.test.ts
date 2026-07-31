import { describe, it, expect } from "vitest";
import type { Time } from "cochart-charts";
import { shiftPoints } from "./clipboard";
import { Point } from "@/core/chart/types";

const pt = (time: number, price: number): Point => ({ time: time as Time, price });

describe("shiftPoints", () => {
	it("translates every point by the same time and price delta", () => {
		const points = [pt(100, 10), pt(200, 20)];
		expect(shiftPoints(points, 5, 1.5)).toEqual([pt(105, 11.5), pt(205, 21.5)]);
	});

	it("preserves the shape (relative spacing) between points", () => {
		const points = [pt(100, 10), pt(160, 40)];
		const shifted = shiftPoints(points, 12, -3);
		expect((shifted[1].time as number) - (shifted[0].time as number)).toBe(60);
		expect(shifted[1].price - shifted[0].price).toBe(30);
	});

	it("handles a single-point drawing", () => {
		expect(shiftPoints([pt(100, 10)], 5, 2)).toEqual([pt(105, 12)]);
	});

	it("does not mutate the input array", () => {
		const points = [pt(100, 10)];
		shiftPoints(points, 5, 2);
		expect(points).toEqual([pt(100, 10)]);
	});
});
