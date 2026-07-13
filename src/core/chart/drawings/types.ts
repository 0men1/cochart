import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { Point } from "@/core/chart/types";

export type EditableOptionType = 'text' | 'color' | 'number' | 'boolean' | 'levels';

// Stable identity for each editable drawing option. Values MUST equal the
// corresponding `BaseOptions` property name so `updateOptions({ [key]: value })`
// and reads stay correct. The settings page picks a control component per key.
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
}

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
  labelText?: string
  labelBackgroundColor?: string;
  labelTextColor?: string;
  showLabel?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  extendLeft?: boolean,
  extendRight?: boolean,
  levels?: number[];
  // Per-level colors, index-aligned with `levels`. A missing entry falls back to
  // the uniform `color` (when set) or the built-in Fibonacci palette.
  levelColors?: string[];
}
