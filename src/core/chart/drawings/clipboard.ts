import { Coordinate, IChartApi, ISeriesApi, SeriesType, Time } from "cochart-charts";
import { Point } from "@/core/chart/types";
import {
	coordinateToTimeExtrapolated,
	timeToCoordinateExtrapolated,
} from "@/core/chart/interval";

// Rigidly translate every point by the same time/price delta, so a pasted clone
// keeps its exact shape while landing offset from the original.
export function shiftPoints(
	points: Point[],
	timeDelta: number,
	priceDelta: number,
): Point[] {
	return points.map((p) => ({
		time: ((p.time as number) + timeDelta) as Time,
		price: p.price + priceDelta,
	}));
}

// Convert a fixed pixel nudge into the equivalent time/price deltas at a
// reference point, so the clone shifts a consistent, visible amount on screen no
// matter the ticker's price magnitude or zoom. Returns null if the reference or
// the nudged position can't be projected (e.g. off-screen / no data yet).
export function pixelNudgeDeltas(
	chart: IChartApi,
	series: ISeriesApi<SeriesType>,
	ref: Point,
	dxPixels: number,
	dyPixels: number,
): { timeDelta: number; priceDelta: number } | null {
	const x = timeToCoordinateExtrapolated(chart, series, ref.time);
	const y = series.priceToCoordinate(ref.price);
	if (x === null || y === null) return null;

	const nudgedTime = coordinateToTimeExtrapolated(chart, series, (x + dxPixels) as Coordinate);
	const nudgedPrice = series.coordinateToPrice((y + dyPixels) as Coordinate);
	if (nudgedTime === null || nudgedPrice === null) return null;

	return {
		timeDelta: (nudgedTime as number) - (ref.time as number),
		priceDelta: (nudgedPrice as number) - ref.price,
	};
}
