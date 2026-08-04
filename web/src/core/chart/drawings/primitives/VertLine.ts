import { CanvasRenderingTarget2D } from "fancy-canvas";
import { logger } from "@cochart/protocol";
import { Coordinate, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitiveAxisView } from "cochart-charts";
import { BaseDrawing } from "./BaseDrawing";
import { GeometryUtils } from "./GeometryUtils";
import { DrawingType, Point, ViewPoint } from "@/core/chart/types";
import { BaseOptions, DrawingOptionKey, EditableOption } from "@/core/chart/drawings/types";
import { applyLineDash, lineStyleOption } from "./lineStyle";

const defaultOptions: BaseOptions = {
  color: '#00FF00',
  labelText: '',
  width: 2,
}

class VertLinePaneRenderer implements IPrimitivePaneRenderer {
  _p1: ViewPoint;
  _options: BaseOptions;

  constructor(p1: ViewPoint, options: BaseOptions) {
    this._p1 = p1;
    this._options = options
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(scope => {
      if (this._p1.x === null) return;

      const ctx = scope.context;
      const x = Math.round(this._p1.x * scope.horizontalPixelRatio);
      ctx.lineWidth = this._options.width * scope.horizontalPixelRatio;
      ctx.strokeStyle = this._options.color;
      applyLineDash(ctx, this._options.lineStyle, this._options.width, scope.verticalPixelRatio);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, scope.bitmapSize.height);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
}

class VertLinePaneView implements IPrimitivePaneView {
  _source: VertLine;
  _p1: ViewPoint = { x: null, y: null }
  private _renderer: VertLinePaneRenderer;

  constructor(source: VertLine) {
    this._source = source;
    this._renderer = new VertLinePaneRenderer(this._p1, this._source.options);
  }

  update() {
    if (this._source["_previewPoints"]) {
      const points = this._source["_previewPoints"];
      this._p1.x = points[0].x;
      this._p1.y = points[0].y;
    }
    else {
      const series = this._source.series;
      this._p1.x = this._source.timeToX(this._source._p1.time);
      this._p1.y = series.priceToCoordinate(this._source._p1.price);
    }
    this._renderer._options = this._source.options;
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
    this._x = this._source.timeToX(this._source._p1.time);
  }

  visible() {
    return false;
  }
  tickVisible() {
    return false;
  }
  coordinate() {
    return this._x ?? 0;
  }
  text() {
    return this._options.labelText!;
  }
  textColor() {
    return "";
  }
  backColor() {
    return "";
  }
}

export class VertLine extends BaseDrawing {
  declare _options: BaseOptions;
  static requiredPoints: number = 1;
  static readonly drawingType = DrawingType.VERTICAL_LINE;

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
  }

  get _p1(): Point { return this._points[0] }

  protected override get hasControlPoints(): boolean {
    return false;
  }

  protected initialize(): void {
    try {
      this._paneViews = [new VertLinePaneView(this)];
      this._timeAxisViews = [new VertLineTimeAxisView(this)]
    } catch (error) {
      logger.error("Failed to initialize VertLine: ", error)
    }
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
    const coord1 = this.getScreenCoordinates(this._p1)
    const chartHeight = this._chart.chartElement().clientHeight;

    if (coord1.x === null || coord1.y === null) { return false; }

    const distance = GeometryUtils.distanceToVerticalLine(x, y, coord1.x, 0, chartHeight);

    return distance <= this.hitThreshold;
  }

}
