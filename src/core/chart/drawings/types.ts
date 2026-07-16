import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { Point } from "@/core/chart/types";

export enum DrawingOptionKey {
  COLOR = 'color',
  WIDTH = 'width',
  FILL_COLOR = 'fillColor',
  FILL_OPACITY = 'fillOpacity',
  SHOW_LABEL = 'showLabel',
  LABEL_TEXT = 'labelText',
  LABEL_BACKGROUND_COLOR = 'labelBackgroundColor',
  LABEL_TEXT_COLOR = 'labelTextColor',
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
  /** Optional section label used to group options on the settings page. */
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
  labelText?: string
  labelBackgroundColor?: string;
  labelTextColor?: string;
  showLabel?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  extendLeft?: boolean,
  extendRight?: boolean,
  levels?: number[];
  levelColors?: string[];
}
