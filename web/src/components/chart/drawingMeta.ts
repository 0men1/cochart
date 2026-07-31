import {
  MoveDiagonal,
  MoveUp,
  Minus,
  MoveUpRight,
  RectangleHorizontal,
  Triangle,
  AlignJustify,
  Type,
  type LucideIcon,
} from "lucide-react";
import { DrawingType } from "@/core/chart/types";

// Single source of truth for a drawing type's human-readable label and icon,
// shared by the tool palette (ToolBox), the settings modal, and the drawing
// manager so the three never drift apart.
export const DRAWING_TYPE_META: Record<DrawingType, { label: string; icon: LucideIcon }> = {
  [DrawingType.VERTICAL_LINE]: { label: "Vertical Line", icon: MoveUp },
  [DrawingType.HORIZONTAL_LINE]: { label: "Horizontal Line", icon: Minus },
  [DrawingType.TREND_LINE]: { label: "Trend Line", icon: MoveDiagonal },
  [DrawingType.RAY]: { label: "Ray", icon: MoveUpRight },
  [DrawingType.RECTANGLE]: { label: "Rectangle", icon: RectangleHorizontal },
  [DrawingType.TRIANGLE]: { label: "Triangle", icon: Triangle },
  [DrawingType.FIBONACCI]: { label: "Fibonacci Retracement", icon: AlignJustify },
  [DrawingType.TEXT]: { label: "Text", icon: Type },
};
