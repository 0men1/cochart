import { Time, UTCTimestamp } from "cochart-charts";

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
