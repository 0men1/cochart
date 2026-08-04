import { describe, it, expect } from "vitest";
import type { Coordinate, Time } from "cochart-charts";
import type { Point } from "@/core/chart/types";
import { FibonacciRetracement } from "./FibonacciRetracement";
import { attachToFakeChart, priceToY, timeToX } from "./testDoubles";

// A deliberately wide price span. The default level set is very nearly
// symmetric about 0.5, so on a narrow span an inverted level lands within the
// click tolerance of its mirror and the bug hides; a wide span separates them.
const LOW = 0;
const HIGH = 10_000;

const pts: Point[] = [
  { time: 60 as Time, price: HIGH },
  { time: 120 as Time, price: LOW },
];

function fib() {
  return attachToFakeChart(new FibonacciRetracement(pts));
}

// The mapping the pane view renders with: level 0 sits at p2, level 1 at p1.
function renderedPriceAt(level: number): number {
  return LOW + (HIGH - LOW) * level;
}

describe("FibonacciRetracement hit testing", () => {
  const midX = ((timeToX(60) + timeToX(120)) / 2) as Coordinate;

  it.each([0.236, 0.382, 0.618, 0.786])(
    "selects on the drawn %s level",
    (level) => {
      const y = priceToY(renderedPriceAt(level)) as Coordinate;
      expect(fib().isPointOnDrawing(midX, y)).toBe(true);
    },
  );

  it("does not select far from any level", () => {
    // Midway between the 0.5 and 0.618 lines.
    const between = (renderedPriceAt(0.5) + renderedPriceAt(0.618)) / 2;
    expect(fib().isPointOnDrawing(midX, priceToY(between) as Coordinate)).toBe(false);
  });

  it("selects on the outer 0 and 1 levels", () => {
    expect(fib().isPointOnDrawing(midX, priceToY(LOW) as Coordinate)).toBe(true);
    expect(fib().isPointOnDrawing(midX, priceToY(HIGH) as Coordinate)).toBe(true);
  });
});
