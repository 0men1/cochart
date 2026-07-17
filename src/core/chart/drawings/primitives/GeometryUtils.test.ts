import { describe, it, expect } from "vitest";
import { GeometryUtils } from "./GeometryUtils";

describe("GeometryUtils.distanceToLineSegment", () => {
	it("is 0 for a point lying on the segment", () => {
		// Midpoint of the horizontal segment (0,0)->(10,0).
		expect(GeometryUtils.distanceToLineSegment(5, 0, 0, 0, 10, 0)).toBe(0);
	});

	it("returns the perpendicular distance when the foot falls on the segment", () => {
		// (5,3) projects onto (5,0) on the segment (0,0)->(10,0).
		expect(GeometryUtils.distanceToLineSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
	});

	it("clamps to the nearest endpoint when the projection falls outside", () => {
		// (-4,3) is nearest the (0,0) endpoint: distance = sqrt(16+9) = 5.
		expect(GeometryUtils.distanceToLineSegment(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5);
	});

	it("treats a zero-length segment as a point", () => {
		// Degenerate segment collapses to the point (2,2); distance to (5,6) = 5.
		expect(GeometryUtils.distanceToLineSegment(5, 6, 2, 2, 2, 2)).toBeCloseTo(5);
	});
});

describe("GeometryUtils.isPointInRectangle", () => {
	// Rectangle at (0,0) with width 10, height 4.
	it("is true for a point inside", () => {
		expect(GeometryUtils.isPointInRectangle(5, 2, 0, 0, 10, 4)).toBe(true);
	});

	it("is true for a point on the border", () => {
		expect(GeometryUtils.isPointInRectangle(0, 0, 0, 0, 10, 4)).toBe(true);
		expect(GeometryUtils.isPointInRectangle(10, 4, 0, 0, 10, 4)).toBe(true);
	});

	it("is false for a point outside", () => {
		expect(GeometryUtils.isPointInRectangle(11, 2, 0, 0, 10, 4)).toBe(false);
		expect(GeometryUtils.isPointInRectangle(5, -1, 0, 0, 10, 4)).toBe(false);
	});
});

describe("GeometryUtils.isPointInTriangle", () => {
	// Triangle with vertices (0,0), (10,0), (0,10).
	const tri = [0, 0, 10, 0, 0, 10] as const;

	it("is true for a point clearly inside", () => {
		expect(GeometryUtils.isPointInTriangle(2, 2, ...tri)).toBe(true);
	});

	it("is true for a point on an edge", () => {
		// Midpoint of the hypotenuse (5,5).
		expect(GeometryUtils.isPointInTriangle(5, 5, ...tri)).toBe(true);
	});

	it("is false for a point outside", () => {
		// Just past the hypotenuse.
		expect(GeometryUtils.isPointInTriangle(6, 6, ...tri)).toBe(false);
		expect(GeometryUtils.isPointInTriangle(-1, 5, ...tri)).toBe(false);
	});

	it("detects inside regardless of vertex winding order", () => {
		// Same triangle, vertices listed clockwise.
		expect(GeometryUtils.isPointInTriangle(2, 2, 0, 0, 0, 10, 10, 0)).toBe(true);
	});
});

describe("GeometryUtils.distanceToRectangle", () => {
	// Rectangle at (0,0) with width 10, height 4.
	it("is 0 for a point inside", () => {
		expect(GeometryUtils.distanceToRectangle(5, 2, 0, 0, 10, 4)).toBe(0);
	});

	it("returns the nearest-edge distance for a point outside", () => {
		// 3 units to the right of the right edge (x=10), within vertical bounds.
		expect(GeometryUtils.distanceToRectangle(13, 2, 0, 0, 10, 4)).toBeCloseTo(3);
		// 5 units below the bottom edge (y=4), within horizontal bounds.
		expect(GeometryUtils.distanceToRectangle(5, 9, 0, 0, 10, 4)).toBeCloseTo(5);
	});

	it("returns the corner distance for a point diagonally outside", () => {
		// (13,8) is nearest the (10,4) corner: distance = sqrt(9+16) = 5.
		expect(GeometryUtils.distanceToRectangle(13, 8, 0, 0, 10, 4)).toBeCloseTo(5);
	});
});
