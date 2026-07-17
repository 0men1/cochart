import { describe, it, expect } from "vitest";
import type { Time } from "cochart-charts";
import { Rectangle } from "./Rectangle";
import { Triangle } from "./Triangle";
import { HorizontalLine } from "./HorizontalLine";
import { VertLine } from "./VertLine";
import type { Point } from "@/core/chart/types";

const pts: Point[] = [
  { time: 1 as Time, price: 100 },
  { time: 2 as Time, price: 110 },
];
const triPts: Point[] = [...pts, { time: 3 as Time, price: 90 }];

describe("drawing visibility gate", () => {
  it("renders pane views when visible (default)", () => {
    expect(new Rectangle(pts).paneViews().length).toBeGreaterThan(0);
    expect(new Triangle(triPts).paneViews().length).toBeGreaterThan(0);
  });

  it("suppresses pane views when hidden", () => {
    expect(new Rectangle(pts, { visible: false }).paneViews()).toEqual([]);
    expect(new Triangle(triPts, { visible: false }).paneViews()).toEqual([]);
    expect(new HorizontalLine(pts, { visible: false }).paneViews()).toEqual([]);
    expect(new VertLine(pts, { visible: false }).paneViews()).toEqual([]);
  });

  it("suppresses axis-label views when hidden", () => {
    expect(new HorizontalLine(pts, { visible: false }).priceAxisViews()).toEqual([]);
    expect(new HorizontalLine(pts).priceAxisViews().length).toBeGreaterThan(0);
    expect(new VertLine(pts, { visible: false }).timeAxisViews()).toEqual([]);
    expect(new VertLine(pts).timeAxisViews().length).toBeGreaterThan(0);
  });
});

describe("isVisible / isLocked getters", () => {
  it("default to visible + unlocked", () => {
    const r = new Rectangle(pts);
    expect(r.isVisible).toBe(true);
    expect(r.isLocked).toBe(false);
  });

  it("reflect constructor options", () => {
    expect(new Rectangle(pts, { visible: false }).isVisible).toBe(false);
    expect(new Rectangle(pts, { locked: true }).isLocked).toBe(true);
  });
});
