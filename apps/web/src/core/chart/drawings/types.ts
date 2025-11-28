import { Coordinate } from "lightweight-charts";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { Point } from "@/core/chart/types";

export interface BaseDrawingHandler {
    onStart(): void;
    onClick(x: Coordinate, y: Coordinate): BaseDrawing | null;
    onCancel(): void;
}

export type DrawingTool = 'trendline' | 'verticalLine' | null;

export type EditableOptionType = 'text' | 'color' | 'number' | 'boolean';

export interface EditableOption {
    key: string;
    label: string;
    type: EditableOptionType;
    currentValue?: string | number | boolean;
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
}

export interface ISerializable {
    serialize(): SerializedDrawing
}

export interface DrawingToolHandler extends BaseDrawingHandler {
    createDrawing(points: Point[]): BaseDrawing | null;
}

export interface DrawingConfig {
    requiredPoints: number;
    allowContinuousDrawing?: boolean;
}

export interface DrawingOperation {
    id: string;
    type: 'delete' | 'create' | 'modify';
    timestamp: Date;
    drawingId: string;
    canUndo: boolean;
}
