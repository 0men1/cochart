import { describe, it, expect } from "vitest";
import type { Time } from "cochart-charts";
import { Triangle } from "./Triangle";
import { DrawingOptionKey } from "../types";
import { DrawingType } from "@/core/chart/types";
import type { Point } from "@/core/chart/types";

const pts: Point[] = [
  { time: 1 as Time, price: 100 },
  { time: 2 as Time, price: 120 },
  { time: 3 as Time, price: 90 },
];

describe("Triangle", () => {
  it("requires three points", () => {
    expect(Triangle.requiredPoints).toBe(3);
  });

  it("serializes as a TRIANGLE with its points and options", () => {
    const t = new Triangle(pts, { color: "#ff0000" });
    const s = t.serialize();
    expect(s.type).toBe(DrawingType.TRIANGLE);
    expect(s.points).toEqual(pts);
    expect(s.options.color).toBe("#ff0000");
    expect(s.isDeleted).toBe(false);
  });

  it("exposes border + fill editable options", () => {
    const m = new Map(new Triangle(pts).getEditableOptions().map((o) => [o.key, o]));
    expect(m.get(DrawingOptionKey.COLOR)?.type).toBe("color");
    expect(m.get(DrawingOptionKey.SHOW_BORDER)?.type).toBe("boolean");
    expect(m.get(DrawingOptionKey.FILL_COLOR)?.type).toBe("color");
    expect(m.get(DrawingOptionKey.FILL_OPACITY)).toMatchObject({ type: "number", min: 0, max: 1, step: 0.05 });
  });
});
