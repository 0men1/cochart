import { Coordinate, IChartApi, ISeriesApi, Logical, SeriesType, Time, UTCTimestamp } from "cochart-charts";

let activeIntervalSeconds = 60; // default 1m until the chart sets it

export function setActiveIntervalSeconds(seconds: number) {
	if (seconds > 0) activeIntervalSeconds = seconds;
}

export function getActiveIntervalSeconds() {
	return activeIntervalSeconds;
}

// Bucket a time to the candle it falls in (floor), matching useCandleChart.ts:76.
export function snapTimeToInterval(time: Time, seconds = activeIntervalSeconds): Time {
	if (typeof time !== "number" || seconds <= 0) return time; // only UTCTimestamp
	return (Math.floor(time / seconds) * seconds) as UTCTimestamp;
}

// Map a point time to an x-coordinate. When the time has no backing bar (future
// whitespace or beyond loaded history), fall back to the continuous logical axis
// anchored on the last real bar, so drawings render wherever they're placed and
// bind seamlessly to the real bar once candles catch up.
export function timeToCoordinateExtrapolated(
	chart: IChartApi,
	series: ISeriesApi<SeriesType>,
	time: Time,
): Coordinate | null {
	const ts = chart.timeScale();
	const snapped = snapTimeToInterval(time);
	const direct = ts.timeToCoordinate(snapped);
	if (direct !== null) return direct; // real bar exists
	if (typeof snapped !== "number") return null;
	const data = series.data();
	const last = data[data.length - 1];
	if (!last || typeof last.time !== "number") return null;
	const offset = (snapped - last.time) / activeIntervalSeconds; // bars from last
	return ts.logicalToCoordinate(((data.length - 1) + offset) as Logical);
}

// Map an x-coordinate to a point time. In whitespace `coordinateToTime` is null,
// so extrapolate an interval-aligned time from the last real bar via the logical
// axis, letting drawings be placed/dragged into the future.
export function coordinateToTimeExtrapolated(
	chart: IChartApi,
	series: ISeriesApi<SeriesType>,
	x: Coordinate,
): Time | null {
	const ts = chart.timeScale();
	const direct = ts.coordinateToTime(x);
	if (direct !== null) return direct; // inside data
	const logical = ts.coordinateToLogical(x);
	if (logical === null) return null;
	const data = series.data();
	const last = data[data.length - 1];
	if (!last || typeof last.time !== "number") return null;
	const offsetBars = Math.round(logical - (data.length - 1));
	return (last.time + offsetBars * activeIntervalSeconds) as UTCTimestamp;
}
