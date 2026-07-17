import { describe, it, expect } from "vitest";
import type { Time } from "cochart-charts";
import { DRAWING_REGISTRY, createDrawing, restoreDrawing } from "./registry";
import { DrawingType, type Point } from "@/core/chart/types";

// Enough points for the greediest primitive (triangle needs 3).
const pts: Point[] = [
  { time: 1 as Time, price: 100 },
  { time: 2 as Time, price: 110 },
  { time: 3 as Time, price: 90 },
];

describe("DRAWING_REGISTRY", () => {
  it("has an entry for every DrawingType", () => {
    for (const type of Object.values(DrawingType)) {
      expect(DRAWING_REGISTRY[type], `missing registry entry for ${type}`).toBeTruthy();
    }
  });
});

describe("createDrawing", () => {
  it("builds an instance whose serialized type matches the requested type", () => {
    for (const type of Object.values(DrawingType)) {
      const inst = createDrawing(type, pts);
      expect(inst).not.toBeNull();
      expect(inst!.serialize().type).toBe(type);
    }
  });

  it("returns null for an unknown type", () => {
    expect(createDrawing("NOPE" as DrawingType, pts)).toBeNull();
  });

  it("preserves a provided id", () => {
    const inst = createDrawing(DrawingType.RECTANGLE, pts, undefined, "fixed-id");
    expect(inst!.id).toBe("fixed-id");
  });
});

describe("restoreDrawing round-trip", () => {
  it("rebuilds a matching drawing from its serialized form", () => {
    for (const type of Object.values(DrawingType)) {
      const original = createDrawing(type, pts, { color: "#abcdef" })!;
      const restored = restoreDrawing(original.serialize())!;
      expect(restored).not.toBeNull();

      const a = original.serialize();
      const b = restored.serialize();
      expect(b.type).toBe(a.type);
      expect(b.id).toBe(a.id);
      expect(b.points).toEqual(a.points);
      expect(b.options).toEqual(a.options);
    }
  });
});
