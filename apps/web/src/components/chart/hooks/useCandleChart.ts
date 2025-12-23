'use client'

import { useEffect, useRef, useCallback, useState } from "react";
import {
    createChart,
    CandlestickSeries,
    UTCTimestamp,
} from "lightweight-charts";
import { ThemeConfig } from "@/constants/theme";
import { Candlestick, ConnectionState, ConnectionStatus, INTERVALMs, TickData } from "@/core/chart/market-data/types";
import { useApp } from "@/components/chart/context";
import { subscribeToTicks, subscribeToStatus } from "@/core/chart/market-data/tick-data";


export async function fetchHistoricalCandles(ticker: string, timeframe: string, numBars: number): Promise<Candlestick[]> {
    const now = Math.floor(Date.now() / 1000);
    const start = now - numBars * INTERVALMs[timeframe];
    const raw: number[][] = await fetch(`/api/candles?symbol=${ticker}&timeframe=${timeframe}&start=${start}&end=${now}`).then(res => res.json());
    return raw.map(([time, low, high, open, close, volume]) => ({ time: time as UTCTimestamp, open, high, low, close, volume }));
}

export function useCandleChart(
    containerRef: React.RefObject<HTMLDivElement | null>,
) {
    const { state, action, chartRef, seriesRef } = useApp();
    const { symbol, exchange, timeframe } = state.chart.data
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [chartInitialized, setChartInitialized] = useState(false);

    const candleCache = useRef<Map<number, Candlestick>>(new Map());
    const currentCandle = useRef<Candlestick>(null);
    const lastTime = useRef<number>(0);

    const [connectionState, setConnectionState] = useState<ConnectionState | null>(null)

    const unsubscribeTickData = useRef<(() => void)>(null);
    const unsubscribeStatusListener = useRef<(() => void)>(null);

    const interval = INTERVALMs[timeframe];

    const updateChart = useCallback((tick: TickData) => {
        if (!seriesRef.current) return;

        const rounded = Math.floor(tick.timestamp / interval) * interval;
        const existingCandle = candleCache.current.get(rounded);

        if (existingCandle) {
            existingCandle.high = Math.max(existingCandle.high, tick.price);
            existingCandle.low = Math.min(existingCandle.low, tick.price);
            existingCandle.close = tick.price;
            existingCandle.volume = tick.volume;

            currentCandle.current = existingCandle;
            lastTime.current = rounded;
        } else {
            currentCandle.current = {
                time: rounded as UTCTimestamp,
                open: tick.price,
                high: tick.price,
                low: tick.price,
                close: tick.price,
                volume: tick.volume
            }
            lastTime.current = rounded;
        }

        candleCache.current.set(currentCandle.current.time, currentCandle.current);
        seriesRef.current.update({
            ...currentCandle.current,
            // time: currentCandle.current.time as UTCTimestamp
        });
    }, [interval]);


    // Every few minutes we store atleast 1000 of current candles to cache
    //
    // Always fecth all candles from the most recent stored candle to the time.now() candle to fill in the gap
    // Load new fetched candles with old cached (new first then cached)
    //
    // How to set up timed function?
    //


    useEffect(() => {
        const setupTickConnection = async () => {
            try {
                if (connectionState?.status !== ConnectionStatus.CONNECTED) {
                    unsubscribeTickData.current = await subscribeToTicks(symbol, exchange, updateChart);
                    unsubscribeStatusListener.current = await subscribeToStatus(exchange, action.setChartConnectionState);

                    action.setChartConnectionState({ status: ConnectionStatus.CONNECTED, reconnectAttempts: 0 })
                }
            } catch (error) {
                console.error("failed to fetch tick data: ", error)
                action.setChartConnectionState({ status: ConnectionStatus.ERROR, reconnectAttempts: 0 })
            }
        }

        setupTickConnection();

        return () => {
            if (unsubscribeStatusListener.current) {
                unsubscribeStatusListener.current();
            }
            if (unsubscribeTickData.current) {
                unsubscribeTickData.current();
            }

            setConnectionState(null)
            action.setChartConnectionState({ status: ConnectionStatus.DISCONNECTED, reconnectAttempts: 0 })

        }
    }, [symbol, exchange, updateChart])

    useEffect(() => {
        candleCache.current.clear();
    }, [symbol, exchange, timeframe])

    const loadHistoricalCandles = useCallback(async (numBars: number) => {
        try {
            const candles = await fetchHistoricalCandles(symbol, timeframe, numBars)

            candles.forEach(candle => {
                candleCache.current.set(candle.time, candle);
            });

            const sortedCandles = Array.from(candleCache.current.values())
                .sort((a, b) => (a.time) - (b.time));

            if (seriesRef.current) {
                seriesRef.current.setData(sortedCandles);
                setChartInitialized(true);
            }
        } catch (error) {
            console.error(`Error fetching candles: `, error)
        }
    }, [symbol, timeframe])

    const safeCleanup = useCallback(() => {
        try {
            if (resizeObserverRef.current) {
                if (containerRef.current) {
                    resizeObserverRef.current.unobserve(containerRef.current);
                }
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
            if (chartRef.current) {
                chartRef.current.remove();
            }
            if (unsubscribeTickData.current) {
                unsubscribeTickData.current();
                unsubscribeTickData.current = null;
            }
            if (unsubscribeStatusListener.current) {
                unsubscribeStatusListener.current();
                unsubscribeStatusListener.current = null;
            }
            if (candleCache.current) {
                candleCache.current.clear();
            }
        } catch (error) {
            console.error('Error during chart cleanup:', error);
        } finally {
            chartRef.current = null;
            seriesRef.current = null;
            setChartInitialized(false);
        }
    }, [containerRef, unsubscribeStatusListener, unsubscribeTickData]);

    useEffect(() => {
        safeCleanup();
        if (!containerRef.current) return;

        try {
            const chart = createChart(containerRef.current, {
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight,
                layout: state.settings.background.theme === 'light' ? ThemeConfig.light : ThemeConfig.dark,
                crosshair: { mode: state.settings.cursor },
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
                            ? date.toLocaleDateString()
                            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                },
                localization: {
                    timeFormatter: (time: number) => {
                        const date = new Date(time * 1000);
                        return date.toLocaleString([], {
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

            chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRange => {
                if (!logicalRange) return;

                if (logicalRange?.from < 10) {
                    const additionalBars = 50;
                    loadHistoricalCandles(candleCache.current.size + additionalBars)
                }
            })

            const resizeObserver = new ResizeObserver(() => {
                if (!chartRef.current || !containerRef.current) return;
                chartRef.current.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            });

            resizeObserverRef.current = resizeObserver;
            resizeObserver.observe(containerRef.current);

            loadHistoricalCandles(200);

            return () => {
                safeCleanup();
            };
        } catch (error) {
            console.error('Error in chart initialization:', error);
            safeCleanup();
        }

    }, [
        symbol,
        exchange,
        timeframe,
        safeCleanup,
        loadHistoricalCandles,
    ]);

    useEffect(() => {
        if (!chartRef.current) return;
        try {
            chartRef.current.applyOptions({
                layout: state.settings.background.theme === 'light' ? ThemeConfig.light : ThemeConfig.dark,
                crosshair: { mode: state.settings.cursor },
                grid: {
                    vertLines: state.settings.background.grid.vertLines,
                    horzLines: state.settings.background.grid.horzLines
                }
            });
        } catch (error) {
            console.error('Error applying chart options:', error);
        }
    }, [state.settings.cursor, state.settings.background.grid, state.settings.background.theme]);

    useEffect(() => {
        if (!seriesRef.current) return;
        try {
            seriesRef.current.applyOptions({
                upColor: state.settings.candles.upColor,
                downColor: state.settings.candles.downColor,
                borderVisible: state.settings.candles.borderVisible,
                wickUpColor: state.settings.candles.wickupColor,
                wickDownColor: state.settings.candles.wickDownColor,
            });
        } catch (error) {
            console.error('Error applying series options:', error);
        }
    }, [state.settings.candles]);

    return {
        chart: chartRef.current,
        series: seriesRef.current,
        isChartInitialized: chartInitialized
    };
}
