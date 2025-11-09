'use client';

import { useEffect, useRef } from 'react';
import { useCandleChart } from './hooks/useCandleChart';
import { AppProvider, AppState, useApp } from '@/components/chart/context';
import ChartHeader from './ChartHeader';
import Toolbox from './ToolBox';
import CollabStatus from './CollabStatus';
import { DrawingEditor } from './DrawingEditor';
import Settings from './Settings';
import { useChartDrawings } from './hooks/useChartDrawings';

export interface ClientProps {
    roomId?: string;
    initialState?: Partial<AppState>;
}

export default function ClientChart({ roomId, initialState }: ClientProps) {
    return (
        <AppProvider initialState={initialState}>
            <ProvideConsumer roomId={roomId} />
        </AppProvider>
    );
}

function ProvideConsumer({ roomId }: { roomId?: string }) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const { chart, series } = useCandleChart(chartContainerRef);
    const { state, action } = useApp();


    useEffect(() => {
        if (chart && series && chartContainerRef.current) {
            action.initializeApi(chart, series, chartContainerRef.current);
        }
    }, [chart, series, chartContainerRef.current])

    if (roomId != null) {
        action.joinCollabRoom(roomId)
    }

    // useChartInteractions()
    useChartDrawings();
    const { isLoading, id } = state.collaboration.room;

    useEffect(() => {
        const cleanup = () => {
            action.cleanupState();
        };
        window.addEventListener('beforeunload', cleanup);
        return () => {
            window.removeEventListener('beforeunload', cleanup);
        };
    }, []);

    // Show loading UI for collaborative mode
    //
    if (isLoading && id) {
        return (
            <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800 justify-center items-center">
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Loading chart state...
                </div>
                <div className="mt-4">
                    {/* Replace with your preferred spinner component */}
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    // if (!state.chart.chartApi || !state.chart.seriesApi || !state.chart.container) {
    //     console.log(chart, series, chartContainerRef)
    //     return (
    //         <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800 justify-center items-center">
    //             <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">
    //                 Initializing chart...
    //             </div>
    //         </div>
    //     );
    // }

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800">
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="w-full">
                    <ChartHeader />
                </div>
                <div className="flex flex-1 w-full overflow-hidden relative">
                    <Toolbox />
                    <div className="flex-1 relative">
                        <div ref={chartContainerRef} className="w-full h-full" />
                    </div>
                    <div className="absolute top-4 right-4 z-10">
                        <DrawingEditor />
                    </div>
                </div>
                <CollabStatus />
                <Settings />
            </main>
        </div>
    );
}
