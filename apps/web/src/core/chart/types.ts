import { Coordinate, Time } from "cochart-charts";
import { BaseDrawing } from "./drawings/primitives/BaseDrawing";

export interface DrawingConstructor {
	new(points: Point[]): BaseDrawing;
	requiredPoints: number;
}

export enum DrawingType {
	TREND_LINE = 'TREND_LINE',
	VERTICAL_LINE = 'VERTICAL_LINE'
}

export interface Point {
	time: Time,
	price: number
}

export interface ViewPoint {
	x: Coordinate | null;
	y: Coordinate | null;
}
