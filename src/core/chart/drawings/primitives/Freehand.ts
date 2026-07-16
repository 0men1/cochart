import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { logger } from "@/lib/logger";
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, DrawingOptionKey, EditableOption, SerializedDrawing } from '../types';
import { applyLineDash, lineStyleOption } from './lineStyle';

class FreehandPaneRenderer implements IPrimitivePaneRenderer {
	_points: ViewPoint[];
	_options: BaseOptions;

	constructor(points: ViewPoint[], options: BaseOptions) {
		this._points = points;
		this._options = options;
	}

	draw(target: CanvasRenderingTarget2D) {
		target.useBitmapCoordinateSpace(scope => {
			const pts = this._points.filter(p => p.x !== null && p.y !== null);
			if (pts.length === 0) return;

			const ctx = scope.context;
			const hp = scope.horizontalPixelRatio;
			const vp = scope.verticalPixelRatio;

			ctx.lineWidth = this._options.width;
			ctx.strokeStyle = this._options.color;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			applyLineDash(ctx, this._options.lineStyle, this._options.width, hp);

			ctx.beginPath();
			ctx.moveTo(pts[0].x! * hp, pts[0].y! * vp);
			for (let i = 1; i < pts.length; i++) {
				ctx.lineTo(pts[i].x! * hp, pts[i].y! * vp);
			}
			ctx.stroke();
			ctx.setLineDash([]);
		});
	}
}

class FreehandPaneView implements IPrimitivePaneView {
	_source: Freehand;
	_points: ViewPoint[] = [];
	private _renderer: FreehandPaneRenderer;

	constructor(source: Freehand) {
		this._source = source;
		this._renderer = new FreehandPaneRenderer(this._points, this._source.options);
	}

	update() {
		const src = this._source;
		this._points.length = 0;

		if (src["_previewPoints"]) {
			for (const p of src["_previewPoints"] as ViewPoint[]) {
				this._points.push({ x: p.x, y: p.y });
			}
		} else {
			const series = src.series;
			for (const p of src.points) {
				this._points.push({ x: src.timeToX(p.time), y: series.priceToCoordinate(p.price) });
			}
		}

		this._renderer._points = this._points;
		this._renderer._options = src.options;
	}

	renderer() {
		return this._renderer;
	}
}

const defaultOptions: BaseOptions = {
	color: '#ffffff',
	width: 2,
};

export class Freehand extends BaseDrawing {
	declare _options: BaseOptions;
	// Freehand is drawn by dragging, not by clicking N points; this is unused but
	// satisfies the shared drawing shape.
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
			type: DrawingType.FREEHAND,
			points: this._points,
			options: { ...this._options },
			isDeleted: false,
		};
	}

	protected initialize(): void {
		try {
			this._paneViews = [new FreehandPaneView(this)];
		} catch (error) {
			logger.error(`Failed to initialize freehand ${this._id}: `, error);
		}
	}

	// A freehand path drags as a single shape — no per-point control handles.
	showControlPoints(): boolean {
		return false;
	}

	getEditableOptions(): EditableOption[] {
		return [
			{
				key: DrawingOptionKey.COLOR,
				label: 'Line Color',
				type: 'color',
				group: 'Line',
				currentValue: this._options.color
			},
			{
				key: DrawingOptionKey.WIDTH,
				label: 'Line Width',
				type: 'number',
				min: 1,
				max: 4,
				step: 1,
				group: 'Line',
				currentValue: this._options.width
			},
			lineStyleOption(this._options.lineStyle),
		];
	}

	isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
		const pts = this._points
			.map(p => this.getScreenCoordinates(p))
			.filter((c): c is { x: Coordinate; y: Coordinate } => c.x !== null && c.y !== null);
		if (pts.length === 0) return false;

		const hitThreshold = Math.max(this._options.width / 2 + 5, 8);

		if (pts.length === 1) {
			const dx = x - pts[0].x;
			const dy = y - pts[0].y;
			return Math.sqrt(dx * dx + dy * dy) <= hitThreshold;
		}

		for (let i = 0; i < pts.length - 1; i++) {
			const distance = GeometryUtils.distanceToLineSegment(
				x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y
			);
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
