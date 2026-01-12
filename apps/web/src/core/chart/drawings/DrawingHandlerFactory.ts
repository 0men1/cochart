import { Coordinate, IChartApi, ISeriesApi, SeriesType } from 'cochart-charts';
import { DrawingConstructor, DrawingType, Point } from '../types';
import { TrendLine } from './primitives/TrendLine';
import { VertLine } from './primitives/VertLine';
import { BaseDrawing } from './primitives/BaseDrawing';

const DRAWING_CLASSES: Record<DrawingType, DrawingConstructor> = {
	TREND_LINE: TrendLine,
	VERTICAL_LINE: VertLine,
}

export class BaseDrawingHandler {
	private _chart: IChartApi;
	private _series: ISeriesApi<SeriesType>;
	private _collectedPoints: Point[] = [];
	private _DrawingClass: DrawingConstructor;

	constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, drawingClass: DrawingConstructor) {
		this._chart = chart;
		this._series = series;
		this._DrawingClass = drawingClass;
	}

	onStart(): void {
		this._collectedPoints = [];
	}

	onClick(x: Coordinate, y: Coordinate): BaseDrawing | null {
		try {
			const timePoint = this._chart.timeScale().coordinateToTime(x);
			const price = this._series.coordinateToPrice(y);

			if (!timePoint || price === null) return null;

			const point: Point = { time: timePoint as any, price };
			this._collectedPoints.push(point);

			if (this._collectedPoints.length === this._DrawingClass.requiredPoints) {
				const drawing = new this._DrawingClass(this._collectedPoints);
				this._collectedPoints = [];
				return drawing;
			}
			return null;
		} catch (error) {
			console.error("failed to create trendline: ", error)
			return null;
		}
	}

	onCancel(): void {
		this._collectedPoints = [];
	}
}


export class DrawingHandlerFactory {
	constructor(
		private chart: IChartApi,
		private series: ISeriesApi<SeriesType>,
	) { }

	createHandler(tool: DrawingType): BaseDrawingHandler | null {
		if (!tool) return null;

		const drawingClass = DRAWING_CLASSES[tool];

		if (!drawingClass) {
			console.error("Invalid drawing tool: ", tool);
			return null;
		}

		return new BaseDrawingHandler(this.chart, this.series, drawingClass);
	}
}
