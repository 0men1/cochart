'use client'

import { useEffect, useRef, useCallback, useState } from "react";
import {
    createChart,
    CandlestickSeries,
    UTCTimestamp,
} from "lightweight-charts";
import { ThemeConfig } from "@/constants/theme";
import { Candlestick, ConnectionState, ConnectionStatus, INTERVAL_SECONDS, TickData } from "@/core/chart/market-data/types";
import { useApp } from "@/components/chart/context";
import { subscribeToTicks, subscribeToStatus } from "@/core/chart/market-data/tick-data";
import { fetchHistoricalCandles } from "@/core/chart/market-data/historical-data";

export function useCandleChart(containerRef: React.RefObject<HTMLDivElement | null>) {
    const { state, action, chartRef, seriesRef } = useApp();
    const { symbol, exchange, timeframe } = state.chart.data;
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [chartInitialized, setChartInitialized] = useState(false);

    // DATA STATE
    const currentCandles = useRef<Map<number, Candlestick>>(new Map());
    const firstCandle = useRef<Candlestick | null>(null);
    const currentCandle = useRef<Candlestick | null>(null);

    // FETCHING LOCK
    const isFetching = useRef(false);

    const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
    const unsubscribeTickData = useRef<(() => void) | null>(null);
    const unsubscribeStatusListener = useRef<(() => void) | null>(null);

    const interval = INTERVAL_SECONDS[timeframe];

    // LIVE UPDATE LOGIC
    const updateChart = useCallback((tick: TickData) => {
        if (!seriesRef.current) return;

        if (currentCandle.current) {
            if ((tick.timestamp - currentCandle.current?.time) > interval) {
                loadHistoricalCandles(currentCandle.current.time, tick.timestamp);
            }
        }

        const rounded = Math.floor(tick.timestamp / interval) * interval;
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
    // Add cache logic here. If we have a batch of request candles already cached, we can use that instead of fetching
    const loadHistoricalCandles = useCallback(async (anchor: number, end: number) => {
        try {
            const candles = await fetchHistoricalCandles(symbol, state.chart.data.exchange, timeframe, anchor, end);

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
            }
        } catch (error) {
            console.error(`Error fetching candles: `, error);
        }
    }, [symbol, timeframe, seriesRef]);

    // CHART SETUP & SCROLL LISTENER
    useEffect(() => {
        if (!containerRef.current) return;

        // cleanup previous
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            layout: state.settings.background.theme === 'light' ? ThemeConfig.light : ThemeConfig.dark,
            crosshair: { mode: state.settings.cursor }, // Normal=0, Magnet=1, Hidden=2, MagentOHLC=3
            grid: {
                vertLines: state.settings.background.grid.vertLines,
                horzLines: state.settings.background.grid.horzLines
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: timeframe === '1m',
                tickMarkFormatter: (time: number) => {
                    const date = new Date(time * 1000);
                    return (timeframe === '1D' || timeframe === '1W')
                        ? date.toLocaleDateString([], { timeZone: state.settings.timezone })
                        : date.toLocaleTimeString([], { timeZone: state.settings.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
                }
            },
            localization: {
                timeFormatter: (time: number) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleString([], {
                        timeZone: state.settings.timezone,
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false
                    });
                }
            }
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: state.settings.candles.upColor,
            downColor: state.settings.candles.downColor,
            borderVisible: state.settings.candles.borderVisible,
            wickUpColor: state.settings.candles.wickupColor,
            wickDownColor: state.settings.candles.wickDownColor,
        });

        chartRef.current = chart;
        seriesRef.current = series;

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
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
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
        };

    }, [symbol, timeframe, state.settings.timezone, loadHistoricalCandles, interval, containerRef]);

    // WEBSOCKET SETUP
    useEffect(() => {
        const setupTickConnection = async () => {
            try {
                if (connectionState?.status !== ConnectionStatus.CONNECTED) {
                    unsubscribeTickData.current = await subscribeToTicks(symbol, exchange, updateChart);
                    unsubscribeStatusListener.current = await subscribeToStatus(exchange, action.setChartConnectionState);
                    action.setChartConnectionState({ status: ConnectionStatus.CONNECTED, reconnectAttempts: 0 });
                }
            } catch (error) {
                console.error("failed to fetch tick data: ", error);
                action.setChartConnectionState({ status: ConnectionStatus.ERROR, reconnectAttempts: 0 });
            }
        };

        setupTickConnection();

        return () => {
            if (unsubscribeStatusListener.current) unsubscribeStatusListener.current();
            if (unsubscribeTickData.current) unsubscribeTickData.current();
            setConnectionState(null);
        };
    }, [symbol, exchange, updateChart]);

    // RESET DATA ON SYMBOL CHANGE
    useEffect(() => {
        currentCandles.current.clear();
        firstCandle.current = null;
        setChartInitialized(false);
        // Add cache logic here:
        const now = Math.floor(Date.now() / 1000);
        loadHistoricalCandles(now - (1000 * interval * 2), now);
    }, [symbol, exchange, timeframe, loadHistoricalCandles, interval]);

    // STYLE UPDATES
    useEffect(() => {
        if (!chartRef.current) return;
        chartRef.current.applyOptions({
            layout: state.settings.background.theme === 'light' ? ThemeConfig.light : ThemeConfig.dark,
            crosshair: { mode: state.settings.cursor },
            grid: {
                vertLines: state.settings.background.grid.vertLines,
                horzLines: state.settings.background.grid.horzLines
            }
        });
    }, [state.settings.cursor, state.settings.background, state.settings.background.theme]);

    useEffect(() => {
        if (!seriesRef.current) return;
        seriesRef.current.applyOptions({
            upColor: state.settings.candles.upColor,
            downColor: state.settings.candles.downColor,
            borderVisible: state.settings.candles.borderVisible,
            wickUpColor: state.settings.candles.wickupColor,
            wickDownColor: state.settings.candles.wickDownColor,
        });
    }, [state.settings.candles]);

    return {
        chart: chartRef.current,
        series: seriesRef.current,
        isChartInitialized: chartInitialized
    };
}
