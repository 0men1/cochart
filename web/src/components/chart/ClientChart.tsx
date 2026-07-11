'use client';

import { useEffect, useRef } from 'react';
import { useCandleChart } from './hooks/useCandleChart';
import ChartHeader from './ChartHeader';
import Toolbox from './ToolBox';
import Settings from './Settings';
import { useChartDrawings } from './hooks/useChartDrawings';
import { useChartInteraction } from './hooks/useChartInteractions';
import TickerSearchBox from './TickerSearchBox';
import ChartFooter from './ChartFooter';
import FeatureSpotlight from '../onboarding/FeatureSpotlight';
import { useUIStore } from '@/stores/useUIStore';
import { DrawingEditor } from './DrawingEditor';
import CollabStatus from './CollabStatus';
import SnapshotPrompt from './SnapshotPrompt';
import { useCollabStore } from '@/stores/useCollabStore';
import { ConnectionStatus } from '@/core/chart/market-data/types';
import { ChartSettings } from '@/stores/types';
import { useChartStore } from '@/stores/useChartStore';

export interface SavedState {
  chartSettings: ChartSettings;
}

export default function ClientChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const {
    toggleTickerSearch,
    toggleFeatureSpotlight,
  } = useUIStore();

  useEffect(() => {
    useChartStore.persist.rehydrate();
  }, []);
  const { status, roomId } = useCollabStore();
  const isLoading = status === ConnectionStatus.CONNECTING;

  useCandleChart(chartContainerRef);
  useChartDrawings();
  useChartInteraction()

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full">
          <ChartHeader />
        </div>
        <div className="flex flex-1 w-full overflow-hidden relative">
          <Toolbox />
          <div className="flex-1 relative">
            <div ref={chartContainerRef} className="w-full h-full" />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <DrawingEditor />
            </div>

            <SnapshotPrompt />
            {isLoading && roomId && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="bg-card border border-border p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
                  <div className="text-base font-semibold text-foreground">
                    Connecting to room...
                  </div>
                  <div className="animate-spin h-8 w-8 border-4 border-live border-t-transparent rounded-full" />
                </div>
              </div>
            )}
          </div>

        </div>

        <FeatureSpotlight
          onClose={() => toggleFeatureSpotlight(false)}
        />
        <TickerSearchBox
          onClose={() => toggleTickerSearch(false)}
        />
        <CollabStatus />
        <Settings />
        <ChartFooter />
      </main>
    </div>
  );
}

