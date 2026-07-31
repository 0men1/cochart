import { Coordinate, IChartApi, ISeriesApi, SeriesType } from 'cochart-charts';
import { logger } from "@cochart/protocol";
import { coordinateToTimeExtrapolated } from '../interval';
import { isSnapEnabled, snapPriceToCandle, snapYToCandle } from '../snap';
import { DrawingConstructor, DrawingType, Point } from '../types';
import { getLastDrawingOptions } from './drawingDefaults';
import { DRAWING_REGISTRY } from './registry';
import { BaseDrawing } from './primitives/BaseDrawing';

export class BaseDrawingHandler {
  private _chart: IChartApi;
  private _series: ISeriesApi<SeriesType>;
  private _collectedPoints: Point[] = [];
  private _DrawingClass: DrawingConstructor;
  private _preview: BaseDrawing | null = null;
  private _type: DrawingType;

  constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, drawingClass: DrawingConstructor, type: DrawingType) {
    this._chart = chart;
    this._series = series;
    this._DrawingClass = drawingClass;
    this._type = type;
  }

  private lastOptions() {
    return getLastDrawingOptions(this._type);
  }

  get requiredPoints(): number {
    return this._DrawingClass.requiredPoints;
  }

  onStart(): void {
    this._collectedPoints = [];
  }

  onMove(x: Coordinate, y: Coordinate): void {
    try {
      const required = this._DrawingClass.requiredPoints;
      if (this._collectedPoints.length < 1 || this._collectedPoints.length >= required) {
        return;
      }

      // Lazily create + attach the preview. Seed with placeholder real points
      // (repeat the last anchor) just so the instance is valid; the
      // screen-space preview below is what actually renders. attachPrimitive
      // runs attached() synchronously, wiring _series + requestUpdate.
      if (!this._preview) {
        const seed = [...this._collectedPoints];
        while (seed.length < required) {
          seed.push(this._collectedPoints[this._collectedPoints.length - 1]);
        }
        this._preview = new this._DrawingClass(seed, this.lastOptions());
        this._series.attachPrimitive(this._preview);
      }

      // Committed anchors mapped to pixels, plus the cursor standing in for
      // the not-yet-placed point(s).
      const screen: { x: Coordinate, y: Coordinate }[] = [];
      for (const p of this._collectedPoints) {
        const c = this._preview.getScreenCoordinates(p);
        if (c.x === null || c.y === null) return;
        screen.push({ x: c.x, y: c.y });
      }
      // Snap the live cursor point to the candle while magnet is on; committed
      // anchors were already snapped when they were placed.
      const cursorY = isSnapEnabled() ? snapYToCandle(this._chart, this._series, x, y) : y;
      while (screen.length < required) {
        screen.push({ x, y: cursorY });
      }

      this._preview.setPreviewPoints(screen);
      this._preview.requestUpdate();
    } catch (error) {
      logger.error("failed to update drawing preview: ", error)
    }
  }

  private _clearPreview(): void {
    if (this._preview) {
      try { this._preview.delete(); } catch (e) { logger.error(e); }
      this._preview = null;
    }
  }

  onClick(x: Coordinate, y: Coordinate): BaseDrawing | null {
    try {
      const timePoint = coordinateToTimeExtrapolated(this._chart, this._series, x);
      // With magnet on, snap the price to the candle's nearest OHLC value.
      const price = isSnapEnabled()
        ? (snapPriceToCandle(this._chart, this._series, x, y) ?? this._series.coordinateToPrice(y))
        : this._series.coordinateToPrice(y);

      if (!timePoint || price === null) return null;

      const point: Point = { time: timePoint as any, price };
      this._collectedPoints.push(point);

      if (this._collectedPoints.length === this._DrawingClass.requiredPoints) {
        this._clearPreview();
        const drawing = new this._DrawingClass(this._collectedPoints, this.lastOptions());
        this._collectedPoints = [];
        return drawing;
      }
      return null;
    } catch (error) {
      logger.error("failed to create trendline: ", error)
      return null;
    }
  }

  onCancel(): void {
    this._collectedPoints = [];
    this._clearPreview();
  }
}


export class DrawingHandlerFactory {
  constructor(
    private chart: IChartApi,
    private series: ISeriesApi<SeriesType>,
  ) { }

  createHandler(tool: DrawingType): BaseDrawingHandler | null {
    if (!tool) return null;
    const drawingClass = DRAWING_REGISTRY[tool];
    if (!drawingClass) {
      logger.error("Invalid drawing tool: ", tool);
      return null;
    }
    return new BaseDrawingHandler(this.chart, this.series, drawingClass, tool);
  }
}
