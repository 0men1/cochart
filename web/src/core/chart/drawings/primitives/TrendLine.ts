import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { drawControlPoints } from './ControlPoints';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, EditableOption, SerializedDrawing } from '../types';

class TrendLinePaneRenderer implements IPrimitivePaneRenderer {
	_p1: ViewPoint;
	_p2: ViewPoint;
	_options: BaseOptions;
	_isSelected: boolean;

	constructor(p1: ViewPoint, p2: ViewPoint, options: BaseOptions, isSelected: boolean) {
		this._p1 = p1;
		this._p2 = p2;
		this._options = options;
		this._isSelected = isSelected;
	}

	draw(target: CanvasRenderingTarget2D) {
		target.useBitmapCoordinateSpace(scope => {
			if (
				this._p1.x === null ||
				this._p1.y === null ||
				this._p2.x === null ||
				this._p2.y === null
			)
				return;

			const ctx = scope.context;
			const x1Scaled = Math.round(this._p1.x * scope.horizontalPixelRatio);
			const y1Scaled = Math.round(this._p1.y * scope.verticalPixelRatio);
			const x2Scaled = Math.round(this._p2.x * scope.horizontalPixelRatio);
			const y2Scaled = Math.round(this._p2.y * scope.verticalPixelRatio);

			ctx.lineWidth = this._options.width;
			ctx.strokeStyle = this._options.color;
			ctx.beginPath();
			ctx.moveTo(x1Scaled, y1Scaled);
			ctx.lineTo(x2Scaled, y2Scaled);
			ctx.stroke();

			if (this._isSelected) {
				drawControlPoints(ctx, scope, [
					{ x: x1Scaled, y: y1Scaled },
					{ x: x2Scaled, y: y2Scaled }
				]);
			}
		});
	}
}


class TrendLinePaneView implements IPrimitivePaneView {
	_source: TrendLine;
	_p1: ViewPoint = { x: null, y: null };
	_p2: ViewPoint = { x: null, y: null };
	private _renderer: TrendLinePaneRenderer;


	constructor(source: TrendLine) {
		this._source = source;
		this._renderer = new TrendLinePaneRenderer(this._p1, this._p2, this._source.options, this._source.isSelected());
	}

	update() {
		if (this._source["_previewPoints"]) {
			const points = this._source["_previewPoints"];
			this._p1.x = points[0].x;
			this._p1.y = points[0].y;
			this._p2.x = points[1].x;
			this._p2.y = points[1].y;
		}
		else {
			const series = this._source.series;
			const timeScale = this._source.chart.timeScale();

			this._p1.x = timeScale.timeToCoordinate(this._source._p1.time);
			this._p1.y = series.priceToCoordinate(this._source._p1.price);
			this._p2.x = timeScale.timeToCoordinate(this._source._p2.time);
			this._p2.y = series.priceToCoordinate(this._source._p2.price);
		}

		this._renderer._isSelected = this._source.isSelected();
		this._renderer._options = this._source.options;
	}

	renderer() {
		return this._renderer;
	}
}


const defaultOptions: BaseOptions = {
	color: "#ffffff" as string,
	width: 6,
};

export class TrendLine extends BaseDrawing {
	declare _options: BaseOptions;
	static requiredPoints: number = 2;

	constructor(
		points: Point[],
		options?: Partial<BaseOptions>,
		id?: string,
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


	serialize(): SerializedDrawing {
		return {
			id: this._id,
			type: DrawingType.TREND_LINE,
			points: this._points,
			options: { ...this._options },
			isDeleted: false,
		}
	}

	get _p1(): Point { return this._points[0]; }
	get _p2(): Point { return this._points[1]; }

	protected initialize(): void {
		try {
			this._paneViews = [new TrendLinePaneView(this)];
		} catch (error) {
			console.error(`Failed to initialize trenline ${this._id}: `, error)
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
		];
	}

	isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
		const coord1 = this.getScreenCoordinates(this._p1);
		const coord2 = this.getScreenCoordinates(this._p2);

		if (coord1.x === undefined || coord1.y === undefined || coord2.x === undefined || coord2.y === undefined ||
			coord1.x === null || coord1.y === null || coord2.x === null || coord2.y === null) {
			return false;
		}

		const distance = GeometryUtils.distanceToLineSegment(x, y, coord1.x, coord1.y, coord2.x, coord2.y);
		const hitThreshold = Math.max(this._options.width / 2 + 5, 8);

		return distance <= hitThreshold;
	}

	updateAllViews() {
		this._paneViews.forEach(pv => {
			if ('update' in pv && typeof (pv as any).update === 'function') {
				(pv as any).update();
			}
		});
	}

	paneViews() {
		return this._paneViews;
	}
}
