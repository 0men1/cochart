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
import { useCollabStore } from '@/stores/useCollabStore';
import { ConnectionStatus } from '@/core/chart/market-data/types';
import { LocalStorage } from '@/lib/localStorage';
import { ChartSettings } from '@/stores/types';
import { useChartStore } from '@/stores/useChartStore';

export interface SavedState {
	chartSettings: ChartSettings;
}

function saveStateToLocalStorage(state: SavedState) {
	const { isOpen, ...settingsToSave } = state.chartSettings;
	LocalStorage.setItem('cochart_chart_settings', settingsToSave);
}

export default function ClientChart() {
	const chartContainerRef = useRef<HTMLDivElement>(null);

	const {
		toggleTickerSearch,
		toggleFeatureSpotlight,
	} = useUIStore();

	const { chartSettings } = useChartStore();

	const { status, roomId } = useCollabStore();
	const isLoading = status === ConnectionStatus.CONNECTING;


	useEffect(() => {
		saveStateToLocalStorage({
			chartSettings
		});
	}, [chartSettings])

	useCandleChart(chartContainerRef);
	useChartDrawings();
	useChartInteraction()

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

						{isLoading && roomId && (
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

