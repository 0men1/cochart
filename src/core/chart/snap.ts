import { Coordinate, IChartApi, ISeriesApi, SeriesType } from "cochart-charts";

// "Magnet" snapping toggle, driven by the Cmd/Ctrl key (see useChartInteractions).
// While enabled, drawing control points snap their price to the nearest OHLC
// value of the candle under the cursor. Time/x already snaps to the candle
// bucket via snapTimeToInterval, so only price/y needs handling here.
let snapEnabled = false;

export function setSnapEnabled(v: boolean) {
	snapEnabled = v;
}

export function isSnapEnabled() {
	return snapEnabled;
}

// Nearest OHLC price of the candle under pixel x, chosen by pixel distance to y
// (perceptual), or null when there's no candle there (whitespace / non-OHLC data).
export function snapPriceToCandle(
	chart: IChartApi,
	series: ISeriesApi<SeriesType>,
	x: Coordinate,
	y: Coordinate,
): number | null {
	const logical = chart.timeScale().coordinateToLogical(x);
	if (logical === null) return null;

	const bar = series.dataByIndex(Math.round(logical)) as
		| { open?: number; high?: number; low?: number; close?: number }
		| null;
	if (!bar || bar.open === undefined) return null;

	const candidates = [bar.open, bar.high, bar.low, bar.close].filter(
		(p): p is number => typeof p === "number",
	);

	let best: number | null = null;
	let bestDist = Infinity;
	for (const price of candidates) {
		const yc = series.priceToCoordinate(price);
		if (yc === null) continue;
		const dist = Math.abs(yc - y);
		if (dist < bestDist) {
			bestDist = dist;
			best = price;
		}
	}
	return best;
}

// The snapped y-coordinate for previewing/dragging, or the original y when there's
// nothing to snap to.
export function snapYToCandle(
	chart: IChartApi,
	series: ISeriesApi<SeriesType>,
	x: Coordinate,
	y: Coordinate,
): Coordinate {
	const price = snapPriceToCandle(chart, series, x, y);
	if (price === null) return y;
	return series.priceToCoordinate(price) ?? y;
}
