import { DrawingLineStyle, DrawingOptionKey, EditableOption } from "../types";

// The editable "Line Style" option every line-bearing drawing exposes, so the
// definition lives in one place.
export function lineStyleOption(current: DrawingLineStyle | undefined): EditableOption {
  return {
    key: DrawingOptionKey.LINE_STYLE,
    label: "Line Style",
    type: "lineStyle",
    group: "Style",
    currentValue: current ?? "solid",
  };
}

// Canvas dash pattern (in media pixels) for a line style, scaled off the line
// width so dashes/dots stay proportional as the stroke thickens. Solid returns
// an empty pattern (a continuous line).
export function dashPattern(style: DrawingLineStyle | undefined, width: number): number[] {
  const w = Math.max(width, 1);
  switch (style) {
    case "dashed":
      return [w * 4, w * 3];
    case "dotted":
      return [w, w * 2];
    default:
      return [];
  }
}

// Apply the dash pattern for `style` to a rendering context, converting media
// pixels to bitmap pixels via `pixelRatio`. Callers should reset with
// `ctx.setLineDash([])` after stroking so later strokes (control points, labels)
// stay solid.
export function applyLineDash(
  ctx: CanvasRenderingContext2D,
  style: DrawingLineStyle | undefined,
  width: number,
  pixelRatio: number,
): void {
  ctx.setLineDash(dashPattern(style, width).map((v) => v * pixelRatio));
}
