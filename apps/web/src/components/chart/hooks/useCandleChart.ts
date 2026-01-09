'use client'

import { useEffect, useRef, useCallback, useState } from "react";
import {
	createChart,
	CandlestickSeries,
	UTCTimestamp,
	ColorType,
	IChartApi,
	ISeriesApi,
	SeriesType,
} from "cochart-charts";
import { ThemeConfig } from "@/constants/theme";
import { Candlestick, ConnectionState, ConnectionStatus, INTERVAL_SECONDS, TickData } from "@/core/chart/market-data/types";
import { subscribeToTicks, subscribeToStatus } from "@/core/chart/market-data/tick-data";
import { fetchHistoricalCandles } from "@/core/chart/market-data/historical-data";
import { useChartStore } from "@/stores/useChartStore";

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
			console.error(`Error fetching candles: `, error);
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
				textColor: chartSettings.background.theme === 'light' ? 'black' : 'white',
				background: chartSettings.background.theme === 'light' ? ThemeConfig.light.background : ThemeConfig.dark.background,
			},
			crosshair: { mode: chartSettings.cursor }, // Normal=0, Magnet=1, Hidden=2, MagentOHLC=3
			grid: {
				vertLines: chartSettings.background.grid.vertLines,
				horzLines: chartSettings.background.grid.horzLines
			},
			timeScale: {
				timeVisible: true,
				secondsVisible: timeframe === '1m',
				tickMarkFormatter: (time: number) => {
					const date = new Date(time * 1000);
					return (timeframe === '1D')
						? date.toLocaleDateString([], { timeZone: chartSettings.timezone })
						: date.toLocaleTimeString([], { timeZone: chartSettings.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
				}
			},
			localization: {
				timeFormatter: (time: number) => {
					const date = new Date(time * 1000);
					return date.toLocaleString([], {
						timeZone: chartSettings.timezone,
						year: 'numeric', month: 'short', day: 'numeric',
						hour: '2-digit', minute: '2-digit', hour12: false
					});
				}
			}
		});

		const series = chart.addSeries(CandlestickSeries, {
			upColor: chartSettings.candles.upColor,
			downColor: chartSettings.candles.downColor,
			borderVisible: chartSettings.candles.borderVisible,
			wickUpColor: chartSettings.candles.wickupColor,
			wickDownColor: chartSettings.candles.wickDownColor,
		});

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

	}, [product, timeframe, containerRef]);

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
				console.error("failed to fetch tick data: ", error);
				setDataConnectionState({ status: ConnectionStatus.ERROR, reconnectAttempts: 0 });
			}
		};

		setupTickConnection();

		return () => {
			unsubscribeStatusListener.current?.();
			unsubscribeTickData.current?.();
			setConnectionState(null);
		};
	}, [product, updateChart]);

	// RESET DATA ON SYMBOL CHANGE
	useEffect(() => {
		currentCandles.current.clear();
		firstCandle.current = null;
		setChartInitialized(false);
		const now = Math.floor(Date.now() / 1000);
		loadHistoricalCandles(now - (1000 * interval * 2), now);
	}, [product, timeframe, loadHistoricalCandles, interval]);

	// STYLE UPDATES
	useEffect(() => {
		if (!chartRef.current || !seriesRef.current) return;

		chartRef.current.applyOptions({
			layout: {
				background: {
					type: ColorType.Solid,
					color: chartSettings.background.theme === 'dark' ? '#09090b' : '#ffffff'
				},
				textColor: chartSettings.background.theme === 'dark' ? '#d4d4d8' : '#18181b',
			},
			grid: {
				vertLines: chartSettings.background.grid.vertLines,
				horzLines: chartSettings.background.grid.horzLines
			},
			crosshair: { mode: chartSettings.cursor },
		});
		seriesRef.current.applyOptions({
			upColor: chartSettings.candles.upColor,
			downColor: chartSettings.candles.downColor,
			borderVisible: chartSettings.candles.borderVisible,
			wickUpColor: chartSettings.candles.wickupColor,
			wickDownColor: chartSettings.candles.wickDownColor,
		});
	}, [chartSettings]);

	return {
		isChartInitialized: chartInitialized
	};
}
