'use client';

import { useEffect, useRef } from 'react';
import { useCandleChart } from './hooks/useCandleChart';
import ChartHeader from './ChartHeader';
import Toolbox from './ToolBox';
import Settings from './Settings';
import DrawingSettings from './DrawingSettings';
import DrawingManager from './DrawingManager';
import IndicatorDialog from './IndicatorDialog';
import IndicatorManager from './IndicatorManager';
import IndicatorSettings from './IndicatorSettings';
import { useChartDrawings } from './hooks/useChartDrawings';
import { useChartIndicators } from './hooks/useChartIndicators';
import { useChartInteraction } from './hooks/useChartInteractions';
import TickerSearchBox from './TickerSearchBox';
import ChartFooter from './ChartFooter';
import WelcomeTour from '../onboarding/WelcomeTour';
import { useUIStore } from '@/stores/useUIStore';
import { hasSeenIntro, markIntroSeen } from '@/lib/onboarding';
import { DrawingEditor } from './DrawingEditor';
import ChartInfoBanner from './ChartInfoBanner';
import CollabStatus from './CollabStatus';
import PresenceStack from './PresenceStack';
import ChatPanel from './ChatPanel';
import PeerCursors from './PeerCursors';
import ConnectionBanner from './ConnectionBanner';
import { useCursorBroadcast } from './hooks/useCursorBroadcast';
import { useCollabStore } from '@/stores/useCollabStore';
import { useIdentityStore } from '@/stores/useIdentityStore';
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
    toggleWelcomeTour,
  } = useUIStore();

  const initIdentity = useIdentityStore((s) => s.init);
  useEffect(() => {
    useChartStore.persist.rehydrate();
    // Assign this browser an anonymous identity the moment the app opens.
    initIdentity();
    // Greet first-time visitors with the guided tour (once per browser).
    if (!hasSeenIntro()) toggleWelcomeTour(true);
  }, [initIdentity, toggleWelcomeTour]);

  // Close the tour and remember it was seen, however it was dismissed.
  const handleTourClose = () => {
    toggleWelcomeTour(false);
    markIntroSeen();
  };

  // Drive the whole UI's light/dark theme off the user's chart setting by
  // toggling the `dark` class on <html>, which all design tokens key off of.
  const theme = useChartStore((s) => s.chartSettings.background.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const { status, roomId } = useCollabStore();
  const isLoading = status === ConnectionStatus.CONNECTING;

  useCandleChart(chartContainerRef);
  useChartDrawings();
  useChartIndicators();
  useChartInteraction()
  useCursorBroadcast();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full">
          <ChartHeader />
        </div>
        <div className="flex flex-1 w-full overflow-hidden relative">
          <Toolbox />
          <div className="flex-1 relative min-w-0">
            <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />

            <ChartInfoBanner />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <DrawingEditor />
            </div>

            <PeerCursors />

            <ConnectionBanner />

            <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
              <PresenceStack />
              <ChatPanel />
            </div>

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

          <DrawingManager />
          <IndicatorManager />

        </div>

        <WelcomeTour onClose={handleTourClose} />
        <TickerSearchBox
          onClose={() => toggleTickerSearch(false)}
        />
        <CollabStatus />
        <Settings />
        <DrawingSettings />
        <IndicatorDialog />
        <IndicatorSettings />
        <ChartFooter />
      </main>
    </div>
  );
}

