import { describe, it, expect } from "vitest";
import type { Coordinate, Time } from "cochart-charts";
import type { Point } from "@/core/chart/types";
import { attachToFakeChart, priceToY, timeToX } from "./testDoubles";
import { TrendLine } from "./TrendLine";
import { HorizontalLine } from "./HorizontalLine";
import { VertLine } from "./VertLine";

const p: Point = { time: 60 as Time, price: 100 };
const pts: Point[] = [p, { time: 120 as Time, price: 130 }];

// Screen position of `p` under the fake chart's projection.
const atPoint = () => [timeToX(60) as Coordinate, priceToY(100) as Coordinate] as const;

describe("getControlPointsAt", () => {
  it("reports a handle for drawings that render one", () => {
    const trend = attachToFakeChart(new TrendLine(pts));
    trend.setSelected(true);
    expect(trend.getControlPointsAt(...atPoint())).toBe(0);
  });

  // Regression: neither line renderer draws control points, but the base still
  // reported one — giving them an invisible grab handle that other drawings
  // yielded to in hitTest.
  it("reports none for horizontal lines, which draw no handles", () => {
    const hl = attachToFakeChart(new HorizontalLine([p]));
    hl.setSelected(true);
    expect(hl.getControlPointsAt(...atPoint())).toBeNull();
  });

  it("reports none for vertical lines, which draw no handles", () => {
    const vl = attachToFakeChart(new VertLine([p]));
    vl.setSelected(true);
    expect(vl.getControlPointsAt(...atPoint())).toBeNull();
  });

  it("still lets the lines themselves be selected", () => {
    const [x, y] = atPoint();
    expect(attachToFakeChart(new HorizontalLine([p])).isPointOnDrawing(x, y)).toBe(true);
    expect(attachToFakeChart(new VertLine([p])).isPointOnDrawing(x, y)).toBe(true);
  });
});
