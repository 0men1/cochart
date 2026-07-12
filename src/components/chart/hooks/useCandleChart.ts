'use client'

import { useEffect, useRef, useCallback, useState } from "react";
import { logger } from "@/lib/logger";
import {
	createChart,
	CandlestickSeries,
	UTCTimestamp,
	ColorType,
	IChartApi,
	ISeriesApi,
	LineWidth,
	SeriesType,
} from "cochart-charts";
import { ThemeConfig } from "@/constants/theme";
import { ChartSettings } from "@/stores/types";
import { Candlestick, ConnectionState, ConnectionStatus, INTERVAL_SECONDS, TickData } from "@/core/chart/market-data/types";
import { subscribeToTicks, subscribeToStatus } from "@/core/chart/market-data/tick-data";
import { fetchHistoricalCandles } from "@/core/chart/market-data/historical-data";
import { useChartStore } from "@/stores/useChartStore";
import { IntervalKey } from "@/core/chart/market-data/types";
import { setActiveIntervalSeconds } from "@/core/chart/interval";

// Maps our stored crosshair settings onto the library's crosshair options,
// narrowing the user-facing `width: number` to the library's LineWidth union.
function toCrosshairOptions(settings: ChartSettings) {
	const line = (l: ChartSettings['crosshair']['vertLine']) => ({
		visible: l.visible,
		color: l.color,
		width: l.width as LineWidth,
		style: l.style,
	});
	return {
		mode: settings.cursor,
		vertLine: line(settings.crosshair.vertLine),
		horzLine: line(settings.crosshair.horzLine),
	};
}

// Maps our stored candle settings onto the candlestick series style options.
function toCandleOptions(settings: ChartSettings) {
	return {
		upColor: settings.candles.upColor,
		downColor: settings.candles.downColor,
		wickVisible: settings.candles.wickVisible,
		wickUpColor: settings.candles.wickupColor,
		wickDownColor: settings.candles.wickDownColor,
		borderVisible: settings.candles.borderVisible,
		borderUpColor: settings.candles.borderUpColor,
		borderDownColor: settings.candles.borderDownColor,
	};
}

// Builds the time-axis + crosshair label formatters for a given timezone. The
// candle data stays UTC; only the displayed labels are shifted to `tz`.
function buildTimeFormatters(timeframe: IntervalKey, tz: string) {
	return {
		tickMarkFormatter: (time: number) => {
			const date = new Date(time * 1000);
			return (timeframe === '1D')
				? date.toLocaleDateString([], { timeZone: tz })
				: date.toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
		},
		timeFormatter: (time: number) => {
			const date = new Date(time * 1000);
			return date.toLocaleString([], {
				timeZone: tz,
				year: 'numeric', month: 'short', day: 'numeric',
				hour: '2-digit', minute: '2-digit', hour12: false
			});
		},
	};
}

export function useCandleChart(containerRef: React.RefObject<HTMLDivElement | null>) {
	const { chartSettings } = useChartStore();
	const { product, timeframe } = useChartStore((state) => state.data);
	const { setDataConnectionState, setInstances } = useChartStore((state) => state);

	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const [chartInitialized, setChartInitialized] = useState(false);

	// DATA STATE
	const currentCandles = useRef<Map<number, Candlestick>>(new Map());
	const firstCandle = useRef<Candlestick | null>(null);
	const currentCandle = useRef<Candlestick | null>(null);

	// FETCHING LOCK
	const isFetching = useRef(false);

	const activeSymbolRef = useRef(product.symbol);
	useEffect(() => {
		activeSymbolRef.current = product.symbol;
	}, [product.symbol]);

	const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
	const unsubscribeTickData = useRef<(() => void) | null>(null);
	const unsubscribeStatusListener = useRef<(() => void) | null>(null);

	const interval = INTERVAL_SECONDS[timeframe];

	// Publish the active interval so the drawing layer can snap point times to the
	// current candle boundaries (single active chart, incl. collab rooms).
	useEffect(() => {
		setActiveIntervalSeconds(interval);
	}, [interval]);

	// LIVE UPDATE LOGIC
	const updateChart = useCallback((tick: TickData) => {
		if (!seriesRef.current) return;
		if (activeSymbolRef.current !== product.symbol) return;

		const rounded = Math.floor(tick.timestamp / interval) * interval;
		const previousInterval = rounded - interval;

		if (currentCandles.current.size > 0 && !currentCandles.current.has(previousInterval) && !isFetching.current) {
			const latestTime = currentCandle.current?.time as number || (rounded - interval);
			if (rounded > latestTime) {
				loadHistoricalCandles(latestTime - interval, rounded);
			}
		}

		const existingCandle = currentCandles.current.get(rounded);
		if (existingCandle) {
			existingCandle.high = Math.max(existingCandle.high, tick.price);
			existingCandle.low = Math.min(existingCandle.low, tick.price);
			existingCandle.close = tick.price;
			existingCandle.volume = tick.volume;
			currentCandle.current = existingCandle;
		} else {
			currentCandle.current = {
				time: rounded as UTCTimestamp,
				open: tick.price,
				high: tick.price,
				low: tick.price,
				close: tick.price,
				volume: tick.volume
			};
		}

		currentCandles.current.set(currentCandle.current.time as number, currentCandle.current);
		seriesRef.current.update(currentCandle.current);
	}, [interval, seriesRef]);

	// HISTORICAL FETCH LOGIC
	const loadHistoricalCandles = useCallback(async (anchor: number, end: number) => {
		try {
			if (product.symbol !== activeSymbolRef.current) {
				return;
			}

			const candles = await fetchHistoricalCandles(product.symbol, product.exchange, timeframe, anchor, end);

			// mrge new candles into map
			candles.forEach(candle => { currentCandles.current.set(candle.time as number, candle); });

			// sort full dataset (Required by Lightweight Charts)
			const sortedCandles = Array.from(currentCandles.current.values())
				.sort((a, b) => (a.time as number) - (b.time as number));

			if (seriesRef.current) {
				seriesRef.current.setData(sortedCandles);
				setChartInitialized(true);
			}

			// update the reference to the oldest candle
			if (sortedCandles.length > 0) {
				firstCandle.current = sortedCandles[0];
				currentCandle.current = sortedCandles[sortedCandles.length - 1];
			}
		} catch (error) {
			logger.error(`Error fetching candles: `, error);
		}
	}, [product.symbol, timeframe, seriesRef]);

	// CHART SETUP & SCROLL LISTENER
	useEffect(() => {
		if (!containerRef.current) return;

		const chart = createChart(containerRef.current, {
			width: containerRef.current.clientWidth,
			height: containerRef.current.clientHeight,
			layout: {
				attributionLogo: false,
				fontSize: chartSettings.layout.fontSize,
				textColor: chartSettings.background.theme === 'light' ? 'black' : 'white',
				background: chartSettings.background.theme === 'light' ? ThemeConfig.light.background : ThemeConfig.dark.background,
			},
			crosshair: toCrosshairOptions(chartSettings),
			grid: {
				vertLines: chartSettings.background.grid.vertLines,
				horzLines: chartSettings.background.grid.horzLines
			},
			timeScale: {
				timeVisible: true,
				secondsVisible: timeframe === '1m',
				tickMarkFormatter: buildTimeFormatters(timeframe, chartSettings.timezone).tickMarkFormatter,
			},
			localization: {
				timeFormatter: buildTimeFormatters(timeframe, chartSettings.timezone).timeFormatter,
			}
		});

		const series = chart.addSeries(CandlestickSeries, toCandleOptions(chartSettings));

		chartRef.current = chart;
		seriesRef.current = series;
		setInstances(chart, series);

		chart.timeScale().subscribeVisibleLogicalRangeChange(async (logicalRange) => {
			if (!logicalRange) return;

			// only fetch if we are scrolling into the past (negative index)
			// && we are not already fetching
			if (logicalRange.from < 0 && !isFetching.current) {
				if (!firstCandle.current) return; // Anchocr
				isFetching.current = true; // Lock fetch for this scroll
				const anchorTime = firstCandle.current.time as number;

				// determine how many bars we need to cover the gap + a buffer.
				// We multiply by 1.5 to account for weekends/market close gaps.
				const barsNeeded = Math.abs(logicalRange.from) + 100;
				const timeToFetch = barsNeeded * interval * 1.5;

				const fetchStart = anchorTime - timeToFetch;
				await loadHistoricalCandles(fetchStart, anchorTime);

				isFetching.current = false; // Unlock fetch
			}
		});

		const resizeObserver = new ResizeObserver(() => {
			if (containerRef.current) {
				chart.applyOptions({
					width: containerRef.current.clientWidth,
					height: containerRef.current.clientHeight,
				});
			}
		});
		resizeObserver.observe(containerRef.current);
		resizeObserverRef.current = resizeObserver;

		return () => {
			resizeObserver.disconnect();
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
			setInstances(null, null);
		};

	}, [product.symbol, product.exchange, timeframe, containerRef]);

	// WEBSOCKET SETUP
	useEffect(() => {
		const setupTickConnection = async () => {
			try {
				if (connectionState?.status !== ConnectionStatus.CONNECTED) {
					unsubscribeTickData.current = await subscribeToTicks(product.symbol, product.exchange, updateChart);
					unsubscribeStatusListener.current = await subscribeToStatus(product.exchange, setDataConnectionState);
					setDataConnectionState({ status: ConnectionStatus.CONNECTED, reconnectAttempts: 0 });
				}
			} catch (error) {
				logger.error("failed to fetch tick data: ", error);
				setDataConnectionState({ status: ConnectionStatus.ERROR, reconnectAttempts: 0 });
			}
		};

		setupTickConnection();

		return () => {
			unsubscribeStatusListener.current?.();
			unsubscribeTickData.current?.();
			setConnectionState(null);
		};
	}, [product.symbol, product.exchange, updateChart]);

	// RESET DATA ON SYMBOL CHANGE
	useEffect(() => {
		currentCandles.current.clear();
		firstCandle.current = null;
		setChartInitialized(false);
		const now = Math.floor(Date.now() / 1000);
		loadHistoricalCandles(now - (1000 * interval * 2), now);
	}, [product.symbol, product.exchange, timeframe, loadHistoricalCandles, interval]);

	// STYLE UPDATES
	useEffect(() => {
		if (!chartRef.current || !seriesRef.current) return;

		const { tickMarkFormatter, timeFormatter } = buildTimeFormatters(timeframe, chartSettings.timezone);

		chartRef.current.applyOptions({
			layout: {
				background: {
					type: ColorType.Solid,
					color: chartSettings.background.theme === 'dark' ? '#09090b' : '#ffffff'
				},
				textColor: chartSettings.background.theme === 'dark' ? '#d4d4d8' : '#18181b',
				fontSize: chartSettings.layout.fontSize,
			},
			grid: {
				vertLines: chartSettings.background.grid.vertLines,
				horzLines: chartSettings.background.grid.horzLines
			},
			crosshair: toCrosshairOptions(chartSettings),
			// Re-time axis + crosshair labels when the timezone changes.
			timeScale: { tickMarkFormatter },
			localization: { timeFormatter },
		});
		seriesRef.current.applyOptions(toCandleOptions(chartSettings));
	}, [chartSettings, timeframe]);

	return {
		isChartInitialized: chartInitialized
	};
}
