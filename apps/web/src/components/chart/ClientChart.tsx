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
import { useChartInteraction } from './hooks/useChartInteractions';

export interface ClientProps {
    initialState?: Partial<AppState>;
}

export default function ClientChart({ initialState }: ClientProps) {
    return (
        <AppProvider initialState={initialState}>
            <ProvideConsumer />
        </AppProvider>
    );
}

function ProvideConsumer() {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const { state, action } = useApp();

    useCandleChart(chartContainerRef);
    useChartInteraction(chartContainerRef)
    useChartDrawings();

    useEffect(() => {
        const cleanup = () => {
            action.cleanupState();
        };
        window.addEventListener('beforeunload', cleanup);
        return () => {
            window.removeEventListener('beforeunload', cleanup);
            cleanup();
        };
    }, []);

    const { isLoading, id } = state.collaboration.room;

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800">
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="w-full">
                    <ChartHeader />
                </div>
                <div className="flex flex-1 w-full overflow-hidden relative">
                    <Toolbox />
                    <div className="flex-1 relative">
                        {/* Always render chart container - don't conditionally unmount */}
                        <div ref={chartContainerRef} className="w-full h-full" />

                        {/* Show loading overlay on top if needed */}
                        {isLoading && id && (
                            <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-20">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                                    <div className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
                                        Connecting to room...
                                    </div>
                                    <div className="flex justify-center">
                                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        )}
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

