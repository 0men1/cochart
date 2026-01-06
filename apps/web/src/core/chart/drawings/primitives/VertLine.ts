import { CanvasRenderingTarget2D } from "fancy-canvas";
import { Coordinate, IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitiveAxisView, SeriesType } from "lightweight-charts";
import { BaseDrawing } from "./BaseDrawing";
import { GeometryUtils } from "./GeometryUtils";
import { positionsLine } from "./positions";
import { Point, ViewPoint } from "@/core/chart/types";
import { BaseDrawingHandler, BaseOptions, DrawingConfig, EditableOption, SerializedDrawing } from "@/core/chart/drawings/types";


const defaultOptions: BaseOptions = {
	color: '#00FF00',
	labelText: '',
	width: 3,
	labelBackgroundColor: 'green',
	labelTextColor: 'white',
	showLabel: false,
}

class VertLinePaneRenderer implements IPrimitivePaneRenderer {
	_p1: ViewPoint;
	_options: BaseOptions;
	_isSelected: boolean;

	constructor(p1: ViewPoint, options: BaseOptions, isSelected: boolean) {
		this._p1 = p1;
		this._options = options
		this._isSelected = isSelected
	}

	draw(target: CanvasRenderingTarget2D) {
		target.useBitmapCoordinateSpace(scope => {
			if (this._p1.x === null) return;

			const ctx = scope.context;
			const position = positionsLine(
				this._p1.x,
				scope.horizontalPixelRatio,
				this._options.width
			);
			ctx.fillStyle = this._options.color;
			ctx.fillRect(
				position.position,
				0,
				position.length,
				scope.bitmapSize.height
			);
		});
	}
}



class VertLinePaneView implements IPrimitivePaneView {
	_source: VertLine;
	_p1: ViewPoint = { x: null, y: null }
	private _renderer: VertLinePaneRenderer;

	constructor(source: VertLine) {
		this._source = source;
		this._renderer = new VertLinePaneRenderer(this._p1, this._source.options, this._source.isSelected());
	}

	update() {
		const series = this._source.series;
		const timeScale = this._source.chart.timeScale();
		this._p1.x = timeScale.timeToCoordinate(this._source._p1.time)
		this._p1.y = series.priceToCoordinate(this._source._p1.price)

		this._renderer._isSelected = this._source.isSelected();
		this._renderer._options = this._source._options;
	}

	renderer() {
		return this._renderer;
	}
}

class VertLineTimeAxisView implements ISeriesPrimitiveAxisView {
	_source: VertLine;
	_x: Coordinate | null = null;
	_options: BaseOptions;

	constructor(source: VertLine) {
		this._source = source;
		this._options = source._options;
	}

	update() {
		const timeScale = this._source.chart.timeScale();
		this._x = timeScale.timeToCoordinate(this._source._p1.time);
	}

	visible() {
		return this._options.showLabel!;
	}
	tickVisible() {
		return this._options.showLabel!;
	}
	coordinate() {
		return this._x ?? 0;
	}
	text() {
		return this._options.labelText!;
	}
	textColor() {
		return this._options.labelTextColor!;
	}
	backColor() {
		return this._options.labelBackgroundColor!;
	}
}

export class VertLine extends BaseDrawing {
	static drawingType = "VertLine";
	declare _options: BaseOptions;

	constructor(
		points: Point[],
		options?: Partial<BaseOptions>,
		id?: string
	) {
		super(
			points,
			{ ...defaultOptions, ...options },
			[],
			[],
			id
		);
		this.initialize();
	}

	get _p1(): Point { return this._points[0] }

	serialize(): SerializedDrawing {
		return {
			id: this._id,
			type: VertLine.drawingType,
			points: this._points,
			options: { ...this._options },
			isDeleted: false,
		}
	}

	protected initialize(): void {
		try {
			this._paneViews = [new VertLinePaneView(this)];
			this._timeAxisViews = [new VertLineTimeAxisView(this)]
		} catch (error) {
			console.error("Failed to initialized Vertline: ", error)
		}
	}

	getEditableOptions(): EditableOption[] {
		return [
			{
				key: 'color',
				label: 'Line Color',
				type: 'color',
				currentValue: this._options.color
			},
			{
				key: 'width',
				label: 'Line Width',
				type: 'number',
				currentValue: this._options.width
			},
			{
				key: 'showLabel',
				label: 'Show Label',
				type: 'boolean',
				currentValue: this._options.showLabel
			},
			{
				key: 'labelText',
				label: 'Label Text',
				type: 'text',
				currentValue: this._options.labelText
			},
			{
				key: 'labelBackgroundColor',
				label: 'Label Background',
				type: 'color',
				currentValue: this._options.labelBackgroundColor
			},
			{
				key: 'labelTextColor',
				label: 'Label Text Color',
				type: 'color',
				currentValue: this._options.labelTextColor
			}
		];
	}

	isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
		const coord1 = this.getScreenCoordinates(this._p1)

		const chartHeight = this._chart.chartElement().clientHeight;

		if (coord1.x === null || coord1.y === null) {
			return false;
		}

		const distance = GeometryUtils.distanceToVerticalLine(x, y, coord1.x, 0, chartHeight);
		const hitThreshold = Math.max(this._options.width / 2 + 5, 8);

		return distance <= hitThreshold;
	}

	updateAllViews() {
		this._paneViews.forEach(pw => {
			if ('update' in pw && typeof (pw as any).update === 'function') {
				(pw as any).update();
			}
		});
		this._timeAxisViews.forEach(tw => {
			if ('update' in tw && typeof (tw as any).update === 'function') {
				(tw as any).update();
			}
		});
	}

	paneViews() {
		return this._paneViews;
	}

	timeAxisViews() {
		return this._timeAxisViews;
	}
}

export class VerticalLineHandler implements BaseDrawingHandler {
	private _chart: IChartApi;
	private _series: ISeriesApi<SeriesType>;
	private _collectedPoints: Point[] = [];

	static config: DrawingConfig = {
		requiredPoints: 1,
		allowContinuousDrawing: true
	};

	constructor(chart: IChartApi, series: ISeriesApi<SeriesType>) {
		this._chart = chart;
		this._series = series;
	}

	onStart(): void {
		this._collectedPoints = [];
	}

	onClick(x: Coordinate, y: Coordinate): BaseDrawing | null {
		try {
			const timePoint = this._chart.timeScale().coordinateToTime(x);
			if (!timePoint) return null;
			const price = this._series.coordinateToPrice(y);
			if (price === null) return null;

			const point: Point = { time: timePoint, price: 0 };
			this._collectedPoints.push(point);

			if (this._collectedPoints.length >= VerticalLineHandler.config.requiredPoints) {
				const drawing = this.createDrawing(this._collectedPoints);
				return drawing
			}

			return null;
		} catch (error) {
			console.error("failed to create vertline: ", error);
			return null;
		}
	}

	createDrawing(points: Point[]): BaseDrawing | null {
		try {
			const drawing = new VertLine(points)
			this._collectedPoints = [];
			return drawing
		} catch (e) {
			console.error("error: failed to create vertline. ", e)
			return null;
		}
	}

	onCancel(): void {
		this._collectedPoints = [];
	}
}
