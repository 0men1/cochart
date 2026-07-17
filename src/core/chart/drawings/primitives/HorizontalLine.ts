import { CanvasRenderingTarget2D } from "fancy-canvas";
import { logger } from "@/lib/logger";
import { Coordinate, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitiveAxisView } from "cochart-charts";
import { BaseDrawing } from "./BaseDrawing";
import { GeometryUtils } from "./GeometryUtils";
import { DrawingType, Point, ViewPoint } from "@/core/chart/types";
import { BaseOptions, DrawingOptionKey, EditableOption, SerializedDrawing } from "@/core/chart/drawings/types";
import { applyLineDash, lineStyleOption } from "./lineStyle";

const defaultOptions: BaseOptions = {
  color: '#2962FF',
  width: 2,
};

class HorizontalLinePaneRenderer implements IPrimitivePaneRenderer {
  _p1: ViewPoint;
  _options: BaseOptions;

  constructor(p1: ViewPoint, options: BaseOptions) {
    this._p1 = p1;
    this._options = options;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(scope => {
      if (this._p1.y === null) return;

      const ctx = scope.context;
      const y = Math.round(this._p1.y * scope.verticalPixelRatio);
      ctx.lineWidth = this._options.width * scope.verticalPixelRatio;
      ctx.strokeStyle = this._options.color;
      applyLineDash(ctx, this._options.lineStyle, this._options.width, scope.horizontalPixelRatio);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(scope.bitmapSize.width, y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
}

class HorizontalLinePaneView implements IPrimitivePaneView {
  _source: HorizontalLine;
  _p1: ViewPoint = { x: null, y: null };
  private _renderer: HorizontalLinePaneRenderer;

  constructor(source: HorizontalLine) {
    this._source = source;
    this._renderer = new HorizontalLinePaneRenderer(this._p1, this._source.options);
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

class HorizontalLinePriceAxisView implements ISeriesPrimitiveAxisView {
  _source: HorizontalLine;
  _y: Coordinate | null = null;
  _options: BaseOptions;

  constructor(source: HorizontalLine) {
    this._source = source;
    this._options = source._options;
  }

  update() {
    this._y = this._source.series.priceToCoordinate(this._source._p1.price);
  }

  visible() {
    return true;
  }
  tickVisible() {
    return true;
  }
  coordinate() {
    return this._y ?? 0;
  }
  text() {
    return "";
  }
  textColor() {
    return "";
  }
  backColor() {
    return "";
  }
}

export class HorizontalLine extends BaseDrawing {
  declare _options: BaseOptions;
  static requiredPoints: number = 1;

  private _priceAxisViews: ISeriesPrimitiveAxisView[] = [];

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

  get _p1(): Point { return this._points[0]; }

  serialize(): SerializedDrawing {
    return {
      id: this._id,
      type: DrawingType.HORIZONTAL_LINE,
      points: this._points,
      options: { ...this._options },
      isDeleted: false,
    };
  }

  protected initialize(): void {
    try {
      this._paneViews = [new HorizontalLinePaneView(this)];
      this._priceAxisViews = [new HorizontalLinePriceAxisView(this)];
    } catch (error) {
      logger.error("Failed to initialize HorizontalLine: ", error);
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
    const coord1 = this.getScreenCoordinates(this._p1);
    const chartWidth = this._chart.chartElement().clientWidth;

    if (coord1.x === null || coord1.y === null) { return false; }

    const distance = GeometryUtils.distanceToHorizontalLine(x, y, coord1.y, 0, chartWidth);
    const hitThreshold = Math.max(this._options.width / 2 + 5, 8);

    return distance <= hitThreshold;
  }

  updateAllViews() {
    this._paneViews.forEach(pv => {
      if ('update' in pv && typeof (pv as any).update === 'function') {
        (pv as any).update();
      }
    });
    this._priceAxisViews.forEach(av => {
      if ('update' in av && typeof (av as any).update === 'function') {
        (av as any).update();
      }
    });
  }

  paneViews() {
    return this._paneViews;
  }

  priceAxisViews() {
    return this._priceAxisViews;
  }
}
