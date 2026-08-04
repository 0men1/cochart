import type { Coordinate, IChartApi, ISeriesApi, SeriesType, Time } from "cochart-charts";
import type { BaseDrawing } from "./BaseDrawing";

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 400;
export const PRICE_ORIGIN = 200;

export function priceToY(price: number): number {
  return PRICE_ORIGIN - price;
}

export function timeToX(time: number): number {
  return time;
}

function createFakeChart(): IChartApi {
  const timeScale = {
    timeToCoordinate: (t: Time) =>
      (typeof t === "number" ? timeToX(t) : null) as Coordinate | null,
    coordinateToTime: (x: number) => x as unknown as Time,
    logicalToCoordinate: (l: number) => l as Coordinate,
    coordinateToLogical: (x: number) => x,
  };
  // Only the members the drawing code actually reaches are implemented; the
  // cast keeps the double small instead of stubbing the whole IChartApi.
  return {
    timeScale: () => timeScale,
    chartElement: () => ({ clientWidth: CHART_WIDTH, clientHeight: CHART_HEIGHT }),
  } as unknown as IChartApi;
}

function createFakeSeries(): ISeriesApi<SeriesType> {
  return {
    priceToCoordinate: (p: number) => priceToY(p) as Coordinate,
    coordinateToPrice: (y: number) => PRICE_ORIGIN - y,
    // Non-empty so timeToCoordinateExtrapolated's fallback has a last bar.
    data: () => [{ time: 0 as Time }],
    options: () => ({}),
    applyOptions: () => { },
    detachPrimitive: () => { },
  } as unknown as ISeriesApi<SeriesType>;
}

// Attach a drawing to fake chart/series so coordinate-dependent paths run.
export function attachToFakeChart<T extends BaseDrawing>(drawing: T): T {
  drawing.attached({
    chart: createFakeChart(),
    series: createFakeSeries(),
    requestUpdate: () => { },
  } as unknown as Parameters<BaseDrawing["attached"]>[0]);
  return drawing;
}
