import { logger } from "@/lib/logger";
import { DrawingConstructor, DrawingType, Point } from "@/core/chart/types";
import { BaseDrawing } from "./primitives/BaseDrawing";
import { BaseOptions, SerializedDrawing } from "./types";
import { TrendLine } from "./primitives/TrendLine";
import { VertLine } from "./primitives/VertLine";
import { HorizontalLine } from "./primitives/HorizontalLine";
import { Ray } from "./primitives/Ray";
import { Rectangle } from "./primitives/Rectangle";
import { Triangle } from "./primitives/Triangle";
import { FibonacciRetracement } from "./primitives/FibonacciRetracement";
import { TextLabel } from "./primitives/TextLabel";

// Single source of truth mapping each drawing type to its class, used for both
// creation (tool handlers) and restore (deserialize from storage/collab/undo).
// Typed as a *total* record so adding a DrawingType without a class here is a
// compile error.
export const DRAWING_REGISTRY: Record<DrawingType, DrawingConstructor> = {
  [DrawingType.TREND_LINE]: TrendLine,
  [DrawingType.VERTICAL_LINE]: VertLine,
  [DrawingType.HORIZONTAL_LINE]: HorizontalLine,
  [DrawingType.RAY]: Ray,
  [DrawingType.RECTANGLE]: Rectangle,
  [DrawingType.TRIANGLE]: Triangle,
  [DrawingType.FIBONACCI]: FibonacciRetracement,
  [DrawingType.TEXT]: TextLabel,
};

// Build a drawing instance of the given type. Returns null (and logs) on an
// unknown type or a constructor failure.
export function createDrawing(
  type: DrawingType,
  points: Point[],
  options?: Partial<BaseOptions>,
  id?: string,
): BaseDrawing | null {
  const DrawingClass = DRAWING_REGISTRY[type];
  if (!DrawingClass) {
    logger.error("Invalid drawing type: ", type);
    return null;
  }
  try {
    return new DrawingClass(points, options, id);
  } catch (error) {
    logger.error(`failed to create drawing of type ${type}: `, error);
    return null;
  }
}

// Rebuild a drawing from its serialized form, preserving its id.
export function restoreDrawing(drawing: SerializedDrawing): BaseDrawing | null {
  return createDrawing(drawing.type as DrawingType, drawing.points, drawing.options, drawing.id);
}
