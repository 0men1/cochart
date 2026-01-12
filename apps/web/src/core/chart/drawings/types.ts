import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { Point } from "@/core/chart/types";

export type EditableOptionType = 'text' | 'color' | 'number' | 'boolean';

export enum DrawingOperation {
	CREATE = 'CREATE',
	DELETE = 'DELETE',
	MODIFY = 'MODIFY',
	SELECT = 'SELECT'
}

export type DrawingListener = (drawing: BaseDrawing) => void;

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
