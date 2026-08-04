import { describe, it, expect } from "vitest";
import type { Time } from "cochart-charts";
import { DrawingType, type Point } from "@/core/chart/types";
import { DRAWING_REGISTRY } from "../registry";
import { attachToFakeChart, priceToY, timeToX } from "./testDoubles";
import { TrendLine } from "./TrendLine";
import { HorizontalLine } from "./HorizontalLine";
import { VertLine } from "./VertLine";

// Times are aligned to the default 60s candle interval: timeToX snaps a point
// to its candle before projecting, so sub-interval times would all floor to 0.
const pts: Point[] = [
  { time: 60 as Time, price: 100 },
  { time: 120 as Time, price: 130 },
  { time: 180 as Time, price: 90 },
];

// Enough points for every arity (1, 2 and 3-point drawings).
function build(type: DrawingType) {
  const Ctor = DRAWING_REGISTRY[type];
  return attachToFakeChart(new Ctor(pts.slice(0, Ctor.requiredPoints)));
}

describe("updateAllViews", () => {
  it("refreshes every drawing type without throwing", () => {
    for (const type of Object.values(DrawingType)) {
      expect(() => build(type).updateAllViews(), type).not.toThrow();
    }
  });

  it("projects pane-view points through the chart", () => {
    type TwoPointView = {
      _p1: { x: number | null; y: number | null };
      _p2: { x: number | null; y: number | null };
    };
    const trend = attachToFakeChart(new TrendLine(pts.slice(0, 2)));
    const view = trend.paneViews()[0] as unknown as TwoPointView;

    // Views start unprojected; updateAllViews is what fills them in.
    expect(view._p1).toEqual({ x: null, y: null });

    trend.updateAllViews();
    expect(view._p1).toEqual({ x: timeToX(60), y: priceToY(100) });
    expect(view._p2).toEqual({ x: timeToX(120), y: priceToY(130) });
  });

  // Regression: the base implementation used to walk only _paneViews, so axis
  // labels went stale unless the subclass overrode updateAllViews.
  it("refreshes axis views, not just pane views", () => {
    const hl = attachToFakeChart(new HorizontalLine([pts[0]]));
    hl.updateAllViews();
    const priceAxis = hl.priceAxisViews()[0] as unknown as { _y: number | null };
    expect(priceAxis._y).toBe(priceToY(100));

    const vl = attachToFakeChart(new VertLine([pts[0]]));
    vl.updateAllViews();
    const timeAxis = vl.timeAxisViews()[0] as unknown as { _x: number | null };
    expect(timeAxis._x).toBe(timeToX(60));
  });

  it("is a no-op for a hidden drawing's callers but still updates its views", () => {
    const hidden = attachToFakeChart(new TrendLine(pts.slice(0, 2), { visible: false }));
    expect(hidden.paneViews()).toEqual([]);
    expect(() => hidden.updateAllViews()).not.toThrow();
  });
});
