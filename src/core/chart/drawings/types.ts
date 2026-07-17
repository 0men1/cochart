import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { Point } from "@/core/chart/types";

export enum DrawingOptionKey {
  COLOR = 'color',
  WIDTH = 'width',
  FILL_COLOR = 'fillColor',
  FILL_OPACITY = 'fillOpacity',
  SHOW_BORDER = 'borderVisible',
  EXTEND_LEFT = 'extendLeft',
  EXTEND_RIGHT = 'extendRight',
  LABEL_TEXT = 'labelText',
  LEVELS = 'levels',
  LINE_STYLE = 'lineStyle',
  FONT_SIZE = 'fontSize',
}
export type EditableOptionType = 'text' | 'color' | 'number' | 'boolean' | 'levels' | 'lineStyle';

// How a line is stroked. Stored in options so it serializes, syncs to peers, and
// is remembered as the last-used style per drawing type.
export type DrawingLineStyle = 'solid' | 'dashed' | 'dotted';

export enum DrawingOperation {
  CREATE = 'CREATE',
  DELETE = 'DELETE',
  MODIFY = 'MODIFY',
  SELECT = 'SELECT'
}

export type DrawingListener = (drawing: BaseDrawing) => void;

export interface EditableOption {
  key: DrawingOptionKey;
  label: string;
  type: EditableOptionType;
  currentValue?: string | number | boolean;
  /** Bounds/step for `number` controls (e.g. width 1–4, opacity 0–1). */
  min?: number;
  max?: number;
  step?: number;
  group?: string;
}

export interface SerializedDrawing {
  id: string;
  type: string;
  points: Point[];
  options: BaseOptions;
  isDeleted: boolean;
}

export interface BaseOptions {
  color: string,
  width: number,
  lineStyle?: DrawingLineStyle;
  fontSize?: number;
  fillColor?: string;
  fillOpacity?: number;
  borderVisible?: boolean,
  extendLeft?: boolean,
  extendRight?: boolean,
  visible?: boolean,
  locked?: boolean,
  labelText?: string,
  levels?: number[];
  levelColors?: string[];
}
