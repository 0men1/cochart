import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { logger } from "@/lib/logger";
import { IPrimitivePaneRenderer, IPrimitivePaneView, Coordinate } from 'cochart-charts';
import { BaseDrawing } from './BaseDrawing';
import { GeometryUtils } from './GeometryUtils';
import { drawControlPoints } from './ControlPoints';
import { DrawingType, Point, ViewPoint } from '@/core/chart/types';
import { BaseOptions, DrawingOptionKey, EditableOption, SerializedDrawing } from '../types';
import { applyLineDash } from './lineStyle';

// Extend the p1 -> p2 direction until it leaves the [0, width] x-range, so the
// ray visually continues to the canvas edge. Returns the far endpoint in the
// same (media) coordinate space as the inputs.
function extendToEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
): { x: number, y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Vertical ray: extend straight down/up far past the canvas.
  if (dx === 0) {
    return { x: x2, y: dy >= 0 ? 1e6 : -1e6 };
  }

  // Target edge depends on the horizontal direction of the ray.
  const targetX = dx > 0 ? width : 0;
  const t = (targetX - x1) / dx;
  // Only extend forward (past p2); never behind p1.
  if (t < 1) return { x: x2, y: y2 };
  return { x: targetX, y: y1 + t * dy };
}

class RayPaneRenderer implements IPrimitivePaneRenderer {
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
      const width = scope.bitmapSize.width / scope.horizontalPixelRatio;
      const far = extendToEdge(this._p1.x, this._p1.y, this._p2.x, this._p2.y, width);

      const x1Scaled = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1Scaled = Math.round(this._p1.y * scope.verticalPixelRatio);
      const xFarScaled = Math.round(far.x * scope.horizontalPixelRatio);
      const yFarScaled = Math.round(far.y * scope.verticalPixelRatio);

      ctx.lineWidth = this._options.width;
      ctx.strokeStyle = this._options.color;
      applyLineDash(ctx, this._options.lineStyle, this._options.width, scope.horizontalPixelRatio);
      ctx.beginPath();
      ctx.moveTo(x1Scaled, y1Scaled);
      ctx.lineTo(xFarScaled, yFarScaled);
      ctx.stroke();
      ctx.setLineDash([]);

      if (this._isSelected) {
        drawControlPoints(ctx, scope, [
          { x: x1Scaled, y: y1Scaled },
          { x: Math.round(this._p2.x * scope.horizontalPixelRatio), y: Math.round(this._p2.y * scope.verticalPixelRatio) }
        ]);
      }
    });
  }
}

class RayPaneView implements IPrimitivePaneView {
  _source: Ray;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };
  private _renderer: RayPaneRenderer;

  constructor(source: Ray) {
    this._source = source;
    this._renderer = new RayPaneRenderer(this._p1, this._p2, this._source.options, this._source.isSelected());
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
  color: '#ffffff',
  width: 2,
};

export class Ray extends BaseDrawing {
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
      type: DrawingType.RAY,
      points: this._points,
      options: { ...this._options },
      isDeleted: false,
    };
  }

  get _p1(): Point { return this._points[0]; }
  get _p2(): Point { return this._points[1]; }

  protected initialize(): void {
    try {
      this._paneViews = [new RayPaneView(this)];
    } catch (error) {
      logger.error(`Failed to initialize ray ${this._id}: `, error);
    }
  }

  getEditableOptions(): EditableOption[] {
    return [
      {
        key: DrawingOptionKey.COLOR,
        label: 'Line Color',
        type: 'color',
        currentValue: this._options.color
      },
      {
        key: DrawingOptionKey.WIDTH,
        label: 'Line Width',
        type: 'number',
        min: 1,
        max: 4,
        step: 1,
        currentValue: this._options.width
      },
      {
        key: DrawingOptionKey.LINE_STYLE,
        label: "Line Style",
        type: "lineStyle",
        group: "Style",
        currentValue: this._options.lineStyle ?? "solid",
      }
    ];
  }

  isPointOnDrawing(x: Coordinate, y: Coordinate): boolean {
    const coord1 = this.getScreenCoordinates(this._p1);
    const coord2 = this.getScreenCoordinates(this._p2);

    if (coord1.x === null || coord1.y === null || coord2.x === null || coord2.y === null) {
      return false;
    }

    const chartWidth = this._chart.chartElement().clientWidth;
    const far = extendToEdge(coord1.x, coord1.y, coord2.x, coord2.y, chartWidth);

    const distance = GeometryUtils.distanceToLineSegment(x, y, coord1.x, coord1.y, far.x, far.y);
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
