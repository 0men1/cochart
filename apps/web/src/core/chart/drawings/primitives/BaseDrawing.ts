import { IChartApi, ISeriesApi, SeriesType, ISeriesPrimitive, Time, Coordinate, IPrimitivePaneView, SeriesAttachedParameter, ISeriesPrimitiveAxisView, PrimitiveHoveredItem, PrimitivePaneViewZOrder } from 'cochart-charts';
import { Point } from '@/core/chart/types';
import { BaseOptions, EditableOption, ISerializable, SerializedDrawing } from '../types';

export abstract class BaseDrawing implements ISeriesPrimitive<Time>, ISerializable, PrimitiveHoveredItem {
	protected readonly _id: string;

	abstract serialize(): SerializedDrawing;

	protected _isDestroyed: boolean = false;
	protected _isSelected: boolean = false;

	protected _chart!: IChartApi;
	protected _series!: ISeriesApi<SeriesType>;

	protected _requestUpdate: (() => void) | null = null;
	protected _visibleRangeUpdateHandler: (() => void) | null = null;

	public _paneViews: IPrimitivePaneView[];
	public _timeAxisViews: ISeriesPrimitiveAxisView[];

	protected _previewPoints: { x: Coordinate, y: Coordinate }[] | null = null;

	private _dragStartPoint: { x: number, y: number } | null = null;
	private _initialScreenPoints: { x: number, y: number }[] | null = null;
	private _activeControlPoint: number | null = null;

	externalId: string;
	cursorStyle?: string | undefined;
	isBackground?: boolean | undefined;
	zOrder: PrimitivePaneViewZOrder = "top";

	constructor(
		protected _points: Point[],
		protected _options: BaseOptions,
		paneViews: IPrimitivePaneView[],
		axisViews: ISeriesPrimitiveAxisView[],
		id?: string,
	) {
		this._id = id ? id : crypto.randomUUID();
		this.externalId = this._id;
		this._paneViews = paneViews;
		this._timeAxisViews = axisViews;
		this.initialize();
	}



	onDragStart(x: number, y: number): boolean {
		const hitPointIndex = this.getControlPointsAt(x as Coordinate, y as Coordinate);
		if (hitPointIndex !== null) {
			this._activeControlPoint = hitPointIndex;
		} else if (this.isPointOnDrawing(x, y)) {
			this._activeControlPoint = null;
		} else {
			return false;
		}

		this._isSelected = true;
		this._dragStartPoint = { x, y };
		this._initialScreenPoints = this._points.map(p => {
			const coords = this.getScreenCoordinates(p);
			return {
				x: coords.x ?? 0,
				y: coords.y ?? 0
			};
		});

		return true;
	}

	onDrag(x: number, y: number): void {
		if (!this._dragStartPoint || !this._initialScreenPoints) return;

		const deltaX = x - this._dragStartPoint.x;
		const deltaY = y - this._dragStartPoint.y;

		if (this._activeControlPoint !== null) {
			const newScreenPoints = this._initialScreenPoints.map((p, i) => {
				if (i === this._activeControlPoint) {
					return {
						x: (p.x + deltaX) as Coordinate,
						y: (p.y + deltaY) as Coordinate
					}
				}
				return {
					x: p.x as Coordinate,
					y: p.y as Coordinate
				};
			})
			this.setPreviewPoints(newScreenPoints);
			return;
		}

		const newScreenPoints = this._initialScreenPoints.map(p => ({
			x: (p.x + deltaX) as Coordinate,
			y: (p.y + deltaY) as Coordinate
		}));

		this.setPreviewPoints(newScreenPoints);
	}

	onDragEnd(): void {
		if (this._previewPoints && this._chart && this._series) {
			const newPoints = this._previewPoints.map(p => ({
				time: this._chart.timeScale().coordinateToTime(p.x) as Time,
				price: this._series.coordinateToPrice(p.y) as number
			}));

			if (newPoints.every(p => p.time !== null && p.price !== null)) {
				this.updatePoints(newPoints);
			}
		}

		this._dragStartPoint = null;
		this._initialScreenPoints = null;
		this._previewPoints = null;
		this.updateAllViews();
	}

	get id(): string {
		return this._id
	}

	setPreviewPoints(points: { x: Coordinate, y: Coordinate }[] | null) {
		this._previewPoints = points;
		this.updateAllViews();
	}

	applyPreview(chart: IChartApi, series: ISeriesApi<SeriesType>) {
		if (!this._previewPoints) return;

		const newPoints = this._previewPoints.map(p => ({
			time: chart.timeScale().coordinateToTime(p.x) as Time,
			price: series.coordinateToPrice(p.y) as number
		}));

		this.updatePoints(newPoints);
		this._previewPoints = null;
	}

	async delete(): Promise<void> {
		if (this._isDestroyed) return;
		this._isDestroyed = true;
		this._series.detachPrimitive(this)
		this._series.applyOptions(this._series.options())
		this.updateAllViews();
	}

	attached(param: SeriesAttachedParameter<Time>) {
		this._chart = param.chart;
		this._series = param.series;
		this._requestUpdate = param.requestUpdate

		const updateHandler = () => this.updateAllViews();
		this._chart.timeScale().subscribeVisibleLogicalRangeChange(updateHandler);
		this._visibleRangeUpdateHandler = updateHandler;

		this.updateAllViews();
	}

	detached() {
		this._requestUpdate = null;

		if (this._visibleRangeUpdateHandler) {
			this._chart.timeScale().unsubscribeVisibleLogicalRangeChange(this._visibleRangeUpdateHandler);
			this._visibleRangeUpdateHandler = null;
		}
	}

	hitTest(x: number, y: number): PrimitiveHoveredItem | null {
		if (this.isPointOnDrawing(x, y)) {
			return this;
		};
		return null;
	}

	getControlPointsAt(x: Coordinate, y: Coordinate): number | null {
		if (!this._isSelected) return null;

		const threshold = 8;

		for (let i = 0; i < this._points.length; ++i) {
			const screenCoords = this.getScreenCoordinates(this._points[i])
			if (screenCoords.x === undefined || screenCoords.y === undefined || screenCoords.x === null || screenCoords.y === null) {
				return null;
			}

			if (screenCoords.x === null || screenCoords.y === null) continue;

			const distance = Math.sqrt(
				Math.pow(x - screenCoords.x, 2) + Math.pow(y - screenCoords.y, 2)
			);

			if (distance <= threshold) {
				return i;
			}
		}
		return null;
	}

	getPosition() {
		return {
			points: this._points.map(p => ({
				time: p.time,
				price: p.price,
				screen: this.getScreenCoordinates(p)
			}))
		};
	}

	isSelected(): boolean {
		return this._isSelected;
	}

	setSelected(selected: boolean): void {
		if (this._isSelected === selected) return;
		this._isSelected = selected;
		this.updateAllViews()
	}

	updateOptions(options: Record<string, any>): void {
		this._options = { ...this._options, ...options };
		this.updateAllViews()
	}

	updatePoints(newPoints: Point[]): void {
		this._points = newPoints;
		this.updateAllViews();
	}

	getScreenCoordinates(point: Point): { x: Coordinate | null, y: Coordinate | null } {
		const timeScale = this._chart.timeScale();
		const x = timeScale.timeToCoordinate(point.time);
		const y = this._series.priceToCoordinate(point.price);
		return { x, y };
	}

	movePoint(index: number, newPoint: Point) {
		this._points[index] = newPoint
		this.updateAllViews();
	}

	updateAllViews(): void {
		const updateData = { selected: this._isSelected, points: this._points, options: this._options };
		this._paneViews.forEach(view => {
			if ('update' in view && typeof (view as any).update === 'function') {
				(view as any).update(updateData);
			}
		});
		this._requestUpdate?.();
	}

	get chart(): IChartApi {
		return this._chart;
	}

	get series(): ISeriesApi<SeriesType> {
		return this._series;
	}

	get options(): BaseOptions {
		return this._options;
	}

	get points(): Point[] {
		return this._points;
	}

	abstract isPointOnDrawing(x: number, y: number): boolean;
	abstract paneViews(): IPrimitivePaneView[];
	abstract getEditableOptions(): EditableOption[];
	protected abstract initialize(): void;
}
