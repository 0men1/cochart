import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { drawControlPoints } from './ControlPoints';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, EditableOption, SerializedDrawing } from '../types';

const DEFAULT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

// A distinct colour per common level so the retracement reads at a glance.
const LEVEL_COLORS: Record<number, string> = {
	0: '#787b86',
	0.236: '#f23645',
	0.382: '#ff9800',
	0.5: '#4caf50',
	0.618: '#089981',
	0.786: '#00bcd4',
	1: '#787b86',
};

function colorForLevel(level: number): string {
	return LEVEL_COLORS[level] ?? '#787b86';
}

interface FibLevelView {
	level: number;
	y: Coordinate | null;
	price: number;
}

class FibonacciPaneRenderer implements IPrimitivePaneRenderer {
	_p1: ViewPoint;
	_p2: ViewPoint;
	_levels: FibLevelView[];
	_options: BaseOptions;
	_isSelected: boolean;

	constructor(p1: ViewPoint, p2: ViewPoint, levels: FibLevelView[], options: BaseOptions, isSelected: boolean) {
		this._p1 = p1;
		this._p2 = p2;
		this._levels = levels;
		this._options = options;
		this._isSelected = isSelected;
	}

	draw(target: CanvasRenderingTarget2D) {
		target.useBitmapCoordinateSpace(scope => {
			if (this._p1.x === null || this._p2.x === null) return;

			const ctx = scope.context;
			const hp = scope.horizontalPixelRatio;
			const vp = scope.verticalPixelRatio;

			const xLeft = Math.round(Math.min(this._p1.x, this._p2.x) * hp);
			const xRight = Math.round(Math.max(this._p1.x, this._p2.x) * hp);

			const drawable = this._levels.filter(l => l.y !== null);

			// Shaded bands between consecutive levels.
			for (let i = 0; i < drawable.length - 1; i++) {
				const yA = drawable[i].y! * vp;
				const yB = drawable[i + 1].y! * vp;
				ctx.globalAlpha = this._options.fillOpacity ?? 0.08;
				ctx.fillStyle = colorForLevel(drawable[i].level);
				ctx.fillRect(xLeft, Math.min(yA, yB), xRight - xLeft, Math.abs(yB - yA));
			}
			ctx.globalAlpha = 1;

			// Level lines + labels.
			ctx.lineWidth = this._options.width;
			const fontSize = 11 * vp;
			ctx.font = `${fontSize}px sans-serif`;
			ctx.textBaseline = 'middle';

			for (const lv of drawable) {
				const y = Math.round(lv.y! * vp);
				ctx.strokeStyle = colorForLevel(lv.level);
				ctx.beginPath();
				ctx.moveTo(xLeft, y);
				ctx.lineTo(xRight, y);
				ctx.stroke();

				ctx.fillStyle = colorForLevel(lv.level);
				const label = `${lv.level.toFixed(3)} (${lv.price.toFixed(2)})`;
				ctx.fillText(label, xRight + 4 * hp, y);
			}

			if (this._isSelected && this._p1.y !== null && this._p2.y !== null) {
				drawControlPoints(ctx, scope, [
					{ x: this._p1.x * hp, y: this._p1.y * vp },
					{ x: this._p2.x * hp, y: this._p2.y * vp }
				]);
			}
		});
	}
}

class FibonacciPaneView implements IPrimitivePaneView {
	_source: FibonacciRetracement;
	_p1: ViewPoint = { x: null, y: null };
	_p2: ViewPoint = { x: null, y: null };
	_levels: FibLevelView[] = [];
	private _renderer: FibonacciPaneRenderer;

	constructor(source: FibonacciRetracement) {
		this._source = source;
		this._renderer = new FibonacciPaneRenderer(this._p1, this._p2, this._levels, this._source.options, this._source.isSelected());
	}

	update() {
		const series = this._source.series;

		let price1 = this._source._p1.price;
		let price2 = this._source._p2.price;

		if (this._source["_previewPoints"]) {
			const points = this._source["_previewPoints"];
			this._p1.x = points[0].x;
			this._p1.y = points[0].y;
			this._p2.x = points[1].x;
			this._p2.y = points[1].y;
			// Derive preview prices from the dragged screen coords so levels track.
			price1 = series.coordinateToPrice(points[0].y) ?? price1;
			price2 = series.coordinateToPrice(points[1].y) ?? price2;
		}
		else {
			this._p1.x = this._source.timeToX(this._source._p1.time);
			this._p1.y = series.priceToCoordinate(this._source._p1.price);
			this._p2.x = this._source.timeToX(this._source._p2.time);
			this._p2.y = series.priceToCoordinate(this._source._p2.price);
		}

		const levels = this._source.options.levels ?? DEFAULT_LEVELS;
		this._levels.length = 0;
		for (const level of levels) {
			const price = price1 + (price2 - price1) * level;
			this._levels.push({ level, price, y: series.priceToCoordinate(price) });
		}

		this._renderer._levels = this._levels;
		this._renderer._isSelected = this._source.isSelected();
		this._renderer._options = this._source.options;
	}

	renderer() {
		return this._renderer;
	}
}

const defaultOptions: BaseOptions = {
	color: '#787b86',
	width: 1,
	fillOpacity: 0.08,
	levels: DEFAULT_LEVELS,
};

export class FibonacciRetracement extends BaseDrawing {
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
			type: DrawingType.FIBONACCI,
			points: this._points,
			options: { ...this._options },
			isDeleted: false,
		};
	}

	get _p1(): Point { return this._points[0]; }
	get _p2(): Point { return this._points[1]; }

	protected initialize(): void {
		try {
			this._paneViews = [new FibonacciPaneView(this)];
		} catch (error) {
			console.error(`Failed to initialize fibonacci ${this._id}: `, error);
		}
	}

	getEditableOptions(): EditableOption[] {
		return [
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

		if (coord1.x === null || coord1.y === null || coord2.x === null || coord2.y === null) {
			return false;
		}

		const xLeft = Math.min(coord1.x, coord2.x);
		const xRight = Math.max(coord1.x, coord2.x);
		const levels = this._options.levels ?? DEFAULT_LEVELS;
		const hitThreshold = Math.max(this._options.width / 2 + 5, 8);

		for (const level of levels) {
			const price = this._p1.price + (this._p2.price - this._p1.price) * level;
			const levelY = this._series.priceToCoordinate(price);
			if (levelY === null) continue;
			const distance = GeometryUtils.distanceToHorizontalLine(x, y, levelY, xLeft, xRight);
			if (distance <= hitThreshold) return true;
		}
		return false;
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
