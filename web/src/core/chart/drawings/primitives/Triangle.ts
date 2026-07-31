import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { logger } from "@cochart/protocol";
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { drawControlPoints } from './ControlPoints';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, DrawingOptionKey, EditableOption, SerializedDrawing } from '../types';
import { applyLineDash } from './lineStyle';
import { HIT_TOLERANCE_PX } from '../hit';

class TrianglePaneRenderer implements IPrimitivePaneRenderer {
  _p1: ViewPoint;
  _p2: ViewPoint;
  _p3: ViewPoint;
  _options: BaseOptions;
  _isSelected: boolean;

  constructor(p1: ViewPoint, p2: ViewPoint, p3: ViewPoint, options: BaseOptions, isSelected: boolean) {
    this._p1 = p1;
    this._p2 = p2;
    this._p3 = p3;
    this._options = options;
    this._isSelected = isSelected;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(scope => {
      if (
        this._p1.x === null || this._p1.y === null ||
        this._p2.x === null || this._p2.y === null ||
        this._p3.x === null || this._p3.y === null
      )
        return;

      const ctx = scope.context;
      const x1 = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1 = Math.round(this._p1.y * scope.verticalPixelRatio);
      const x2 = Math.round(this._p2.x * scope.horizontalPixelRatio);
      const y2 = Math.round(this._p2.y * scope.verticalPixelRatio);
      const x3 = Math.round(this._p3.x * scope.horizontalPixelRatio);
      const y3 = Math.round(this._p3.y * scope.verticalPixelRatio);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();

      // Semi-transparent fill.
      ctx.globalAlpha = this._options.fillOpacity ?? 0.2;
      ctx.fillStyle = this._options.fillColor ?? this._options.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Border.
      if (this._options.borderVisible) {
        ctx.lineWidth = this._options.width;
        ctx.strokeStyle = this._options.color;
        applyLineDash(ctx, this._options.lineStyle, this._options.width, scope.horizontalPixelRatio);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (this._isSelected) {
        drawControlPoints(ctx, scope, [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
          { x: x3, y: y3 }
        ]);
      }
    });
  }
}

class TrianglePaneView implements IPrimitivePaneView {
  _source: Triangle;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };
  _p3: ViewPoint = { x: null, y: null };
  private _renderer: TrianglePaneRenderer;

  constructor(source: Triangle) {
    this._source = source;
    this._renderer = new TrianglePaneRenderer(this._p1, this._p2, this._p3, this._source.options, this._source.isSelected());
  }

  update() {
    if (this._source["_previewPoints"]) {
      const points = this._source["_previewPoints"];
      this._p1.x = points[0].x;
      this._p1.y = points[0].y;
      this._p2.x = points[1].x;
      this._p2.y = points[1].y;
      this._p3.x = points[2].x;
      this._p3.y = points[2].y;
    }
    else {
      const series = this._source.series;
      this._p1.x = this._source.timeToX(this._source._p1.time);
      this._p1.y = series.priceToCoordinate(this._source._p1.price);
      this._p2.x = this._source.timeToX(this._source._p2.time);
      this._p2.y = series.priceToCoordinate(this._source._p2.price);
      this._p3.x = this._source.timeToX(this._source._p3.time);
      this._p3.y = series.priceToCoordinate(this._source._p3.price);
    }

    this._renderer._isSelected = this._source.showControlPoints();
    this._renderer._options = this._source.options;
  }

  renderer() {
    return this._renderer;
  }
}

const defaultOptions: BaseOptions = {
  color: '#2962FF',
  width: 2,
  borderVisible: false,
  fillColor: '#2962FF',
  fillOpacity: 0.2,
};

export class Triangle extends BaseDrawing {
  declare _options: BaseOptions;
  static requiredPoints: number = 3;

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
      type: DrawingType.TRIANGLE,
      points: this._points,
      options: { ...this._options },
      isDeleted: false,
    };
  }

  get _p1(): Point { return this._points[0]; }
  get _p2(): Point { return this._points[1]; }
  get _p3(): Point { return this._points[2]; }

  protected initialize(): void {
    try {
      this._paneViews = [new TrianglePaneView(this)];
    } catch (error) {
      logger.error(`Failed to initialize triangle ${this._id}: `, error);
    }
  }

  getEditableOptions(): EditableOption[] {
    return [
      {
        key: DrawingOptionKey.COLOR,
        label: 'Border Color',
        type: 'color',
        group: 'Border',
        currentValue: this._options.color
      },
      {
        key: DrawingOptionKey.SHOW_BORDER,
        label: 'Show Border',
        type: 'boolean',
        currentValue: this._options.borderVisible
      },
      {
        key: DrawingOptionKey.WIDTH,
        label: 'Border Width',
        type: 'number',
        min: 0,
        max: 4,
        step: 1,
        group: 'Border',
        currentValue: this._options.width
      },
      {
        key: DrawingOptionKey.FILL_COLOR,
        label: 'Fill Color',
        type: 'color',
        group: 'Fill',
        currentValue: this._options.fillColor
      },
      {
        key: DrawingOptionKey.FILL_OPACITY,
        label: 'Fill Opacity',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        group: 'Fill',
        currentValue: this._options.fillOpacity
      },
    ];
  }

  isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
    const c1 = this.getScreenCoordinates(this._p1);
    const c2 = this.getScreenCoordinates(this._p2);
    const c3 = this.getScreenCoordinates(this._p3);

    if (
      c1.x === null || c1.y === null ||
      c2.x === null || c2.y === null ||
      c3.x === null || c3.y === null
    ) {
      return false;
    }

    // Anywhere inside the (filled) triangle, or near any of its edges, is a hit.
    if (GeometryUtils.isPointInTriangle(x, y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y)) return true;

    const hitThreshold = Math.max(this._options.width / 2 + 5, HIT_TOLERANCE_PX);
    const distance = Math.min(
      GeometryUtils.distanceToLineSegment(x, y, c1.x, c1.y, c2.x, c2.y),
      GeometryUtils.distanceToLineSegment(x, y, c2.x, c2.y, c3.x, c3.y),
      GeometryUtils.distanceToLineSegment(x, y, c3.x, c3.y, c1.x, c1.y),
    );

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
    return this._options.visible === false ? [] : this._paneViews;
  }
}
