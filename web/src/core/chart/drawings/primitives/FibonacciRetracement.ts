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

const DEFAULT_LEVELS = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];

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

// Default `color`. While it holds this value the per-level palette is used; once
// the user picks a different color in the editor, every level is drawn in it.
const PALETTE_SENTINEL = '#787b86';

function colorForLevel(level: number): string {
  return LEVEL_COLORS[level] ?? PALETTE_SENTINEL;
}

// Resolve a single level's color. Priority: an explicit per-level color, then a
// user-chosen uniform color, then the built-in palette. `index` aligns with the
// `levels` / `levelColors` arrays.
export function fibLevelColor(options: BaseOptions, index: number, level: number): string {
  const perLevel = options.levelColors?.[index];
  if (perLevel) return perLevel;
  return options.color && options.color !== PALETTE_SENTINEL
    ? options.color
    : colorForLevel(level);
}

interface FibLevelView {
  level: number;
  index: number;
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

      // Honor the extend flags: stretch the level lines/bands to the canvas edge
      // on either side. Keep the price labels anchored to the actual right-hand
      // point (`xLabel`) so they stay next to the data instead of sliding off the
      // edge when extended right.
      const xData1 = this._p1.x * hp;
      const xData2 = this._p2.x * hp;
      const xLeft = this._options.extendLeft ? 0 : Math.round(Math.min(xData1, xData2));
      const xRight = this._options.extendRight ? scope.bitmapSize.width : Math.round(Math.max(xData1, xData2));
      const xLabel = Math.round(Math.max(xData1, xData2));

      const drawable = this._levels.filter(l => l.y !== null);

      // Shaded bands between consecutive levels.
      for (let i = 0; i < drawable.length - 1; i++) {
        const yA = drawable[i].y! * vp;
        const yB = drawable[i + 1].y! * vp;
        ctx.globalAlpha = this._options.fillOpacity ?? 0.08;
        ctx.fillStyle = fibLevelColor(this._options, drawable[i].index, drawable[i].level);
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
        const levelColor = fibLevelColor(this._options, lv.index, lv.level);
        ctx.strokeStyle = levelColor;
        applyLineDash(ctx, this._options.lineStyle, this._options.width, hp);
        ctx.beginPath();
        ctx.moveTo(xLeft, y);
        ctx.lineTo(xRight, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = levelColor;
        const label = `${lv.level.toFixed(3)} (${lv.price.toFixed(2)})`;
        ctx.fillText(label, xLabel + 4 * hp, y);
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
    levels.forEach((level, index) => {
      const price = price2 + (price1 - price2) * level;
      this._levels.push({ level, index, price, y: series.priceToCoordinate(price) });
    });

    this._renderer._levels = this._levels;
    this._renderer._isSelected = this._source.showControlPoints();
    this._renderer._options = this._source.options;
  }

  renderer() {
    return this._renderer;
  }
}

const defaultOptions: BaseOptions = {
  color: '#787b86',
  width: 2,
  fillOpacity: 0.08,
  extendLeft: false,
  extendRight: false,
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
      logger.error(`Failed to initialize fibonacci ${this._id}: `, error);
    }
  }

  getEditableOptions(): EditableOption[] {
    return [
      {
        key: DrawingOptionKey.COLOR,
        label: 'All Levels Color',
        type: 'color',
        group: 'Style',
        currentValue: this._options.color
      },
      {
        key: DrawingOptionKey.WIDTH,
        label: 'Line Width',
        type: 'number',
        min: 1,
        max: 4,
        step: 1,
        group: 'Style',
        currentValue: this._options.width
      },
      {
        key: DrawingOptionKey.FILL_OPACITY,
        label: 'Fill Opacity',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        group: 'Style',
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
      {
        key: DrawingOptionKey.LEVELS,
        label: 'Levels',
        type: 'levels',
        group: 'Levels',
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
    const xLeft = this._options.extendLeft ? 0 : Math.min(coord1.x, coord2.x);
    const xRight = this._options.extendRight ? chartWidth : Math.max(coord1.x, coord2.x);
    const levels = this._options.levels ?? DEFAULT_LEVELS;
    const hitThreshold = Math.max(this._options.width / 2 + 5, HIT_TOLERANCE_PX);

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
    return this._options.visible === false ? [] : this._paneViews;
  }
}
