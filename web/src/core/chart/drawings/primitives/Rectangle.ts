import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { logger } from "@/lib/logger";
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { drawControlPoints } from './ControlPoints';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, DrawingOptionKey, EditableOption, SerializedDrawing } from '../types';
import { applyLineDash } from './lineStyle';
import { HIT_TOLERANCE_PX } from '../hit';

class RectanglePaneRenderer implements IPrimitivePaneRenderer {
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
      const x1 = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1 = Math.round(this._p1.y * scope.verticalPixelRatio);
      const x2 = Math.round(this._p2.x * scope.horizontalPixelRatio);
      const y2 = Math.round(this._p2.y * scope.verticalPixelRatio);

      // Stretch the box to the canvas edge on either side when extended.
      const left = this._options.extendLeft ? 0 : Math.min(x1, x2);
      const right = this._options.extendRight ? scope.bitmapSize.width : Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const w = right - left;
      const h = Math.abs(y2 - y1);


      // Semi-transparent fill.
      ctx.globalAlpha = this._options.fillOpacity ?? 0.2;
      ctx.fillStyle = this._options.fillColor ?? this._options.color;
      ctx.fillRect(left, top, w, h);
      ctx.globalAlpha = 1;

      // Border.
      if (this._options.borderVisible) {
        ctx.lineWidth = this._options.width;
        ctx.strokeStyle = this._options.color;
        applyLineDash(ctx, this._options.lineStyle, this._options.width, scope.horizontalPixelRatio);
        ctx.strokeRect(left, top, w, h);
        ctx.setLineDash([]);
      }

      if (this._isSelected) {
        drawControlPoints(ctx, scope, [
          { x: x1, y: y1 },
          { x: x2, y: y2 }
        ]);
      }
    });
  }
}

class RectanglePaneView implements IPrimitivePaneView {
  _source: Rectangle;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };
  private _renderer: RectanglePaneRenderer;

  constructor(source: Rectangle) {
    this._source = source;
    this._renderer = new RectanglePaneRenderer(this._p1, this._p2, this._source.options, this._source.isSelected());
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
      this._p1.x = this._source.timeToX(this._source._p1.time);
      this._p1.y = series.priceToCoordinate(this._source._p1.price);
      this._p2.x = this._source.timeToX(this._source._p2.time);
      this._p2.y = series.priceToCoordinate(this._source._p2.price);
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
  extendLeft: false,
  extendRight: false,
};

export class Rectangle extends BaseDrawing {
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
      type: DrawingType.RECTANGLE,
      points: this._points,
      options: { ...this._options },
      isDeleted: false,
    };
  }

  get _p1(): Point { return this._points[0]; }
  get _p2(): Point { return this._points[1]; }

  protected initialize(): void {
    try {
      this._paneViews = [new RectanglePaneView(this)];
    } catch (error) {
      logger.error(`Failed to initialize rectangle ${this._id}: `, error);
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
      {
        key: DrawingOptionKey.EXTEND_LEFT,
        label: 'Extend Left',
        type: 'boolean',
        group: 'Extend',
        currentValue: this._options.extendLeft
      },
      {
        key: DrawingOptionKey.EXTEND_RIGHT,
        label: 'Extend Right',
        type: 'boolean',
        group: 'Extend',
        currentValue: this._options.extendRight
      },
    ];
  }

  isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
    const coord1 = this.getScreenCoordinates(this._p1);
    const coord2 = this.getScreenCoordinates(this._p2);

    if (coord1.x === null || coord1.y === null || coord2.x === null || coord2.y === null) {
      return false;
    }

    // Mirror the renderer: extended sides reach the chart edge.
    const chartWidth = this._chart.chartElement().clientWidth;
    const left = this._options.extendLeft ? 0 : Math.min(coord1.x, coord2.x);
    const right = this._options.extendRight ? chartWidth : Math.max(coord1.x, coord2.x);
    const top = Math.min(coord1.y, coord2.y);
    const w = right - left;
    const h = Math.abs(coord2.y - coord1.y);

    // Anywhere inside the (filled) box, or near the border, is a hit.
    if (GeometryUtils.isPointInRectangle(x, y, left, top, w, h)) return true;

    const distance = GeometryUtils.distanceToRectangle(x, y, left, top, w, h);
    const hitThreshold = Math.max(this._options.width / 2 + 5, HIT_TOLERANCE_PX);

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
