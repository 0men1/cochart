import { Settings, Wifi } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { useUIStore } from "@/stores/useUIStore";
import { useChartStore } from "@/stores/useChartStore";
import { Product } from "@/stores/types";


function getStatusDiv(status: ConnectionStatus) {
	switch (status) {
		case ConnectionStatus.CONNECTED:
			return (<span className="text-green-500">●</span>)
		case ConnectionStatus.DISCONNECTED:
			return (<span className="text-red-500">●</span>)
		case ConnectionStatus.CONNECTING:
			break;
		case ConnectionStatus.ERROR:
			break;
		case ConnectionStatus.RECONNECTING:
			return (<span className="text-yellow-500">●</span>)
	}
}

export default function ChartHeader() {
	const {
		toggleSettings
	} = useUIStore();

	const { product, timeframe } = useChartStore().data;
	const { data, selectChart } = useChartStore();

	const { toggleTickerSearch } = useUIStore();

	const timeframes: string[] = ["1m", "5m", "15m", "1H", "6H", "1D"];

	const handleChartUpdate = (product: Product, timeframe: IntervalKey) => {
		selectChart(product, timeframe);
	};

	return (
		<div className="flex justify-between items-center w-full h-12 px-2 md:px-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
			{/* Left side components: Ticker + Timeframes */}
			<div className="flex items-center min-w-0 flex-1 mr-2">
				<div className="flex items-center gap-1 w-full">
					{/* Ticker selector - prevent shrinking so it's always visible */}
					<Button
						variant="ghost"
						size="sm"
						className="shrink-0 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 h-8 px-2"
						onClick={() => toggleTickerSearch(true, product.name)}
					>
						{product.name}
					</Button>

					<div className="shrink-0 w-px h-4 bg-slate-300 dark:bg-slate-600 mx-2" />

					{/* Timeframe selector - Scrollable on mobile */}
					<div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
						{timeframes.map((time) => (
							<Button
								key={time}
								variant="ghost"
								size="sm"
								onClick={() => handleChartUpdate(product, time as IntervalKey)}
								className={`
                                    shrink-0 h-8 px-3 text-xs font-medium transition-colors
                                    ${time === timeframe ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-transparent'} `} >
								{time}
							</Button>
						))}
					</div>
				</div>
			</div>


			<div className="flex items-center gap-2 md:gap-7 shrink-0">
				{/* Right side components
				<Button
					onClick={() => { action.toggleCollabWindow(true) }}
					className={isInRoom ? "bg-emerald-600 hover:bg-emerald-700 relative" : ""}
					size="sm" // Smaller on mobile if needed, or stick to default
				>
					{isInRoom ? (
						<>
							<Users size={16} className="md:mr-2" />
							<span className="hidden md:inline">Live</span>
							<span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
						</>
					) : (
						<>
							<Share2 size={16} className="md:mr-2" />
							<span className="hidden md:inline">Share</span>
						</>
					)}
				</Button>
 */}
				{/* Connection Status Icon with Tooltip */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="sm" className="p-2">
							<Wifi size={18} className="text-slate-600 dark:text-slate-400" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="p-3 max-w-xs">
						<div className="space-y-2">
							<h4 className="font-semibold text-sm">Connection Status</h4>
							<div className="space-y-1 text-xs">
								<div className="flex items-center justify-between">
									<span>Collab Connection:</span>
									{/* getStatusDiv(state.collaboration.room.status)*/}
								</div>
								<div className="flex items-center justify-between">
									<span>Candle Data:</span>
									{getStatusDiv(data.connectionState.status)}
								</div>
							</div>
						</div>
					</TooltipContent>
				</Tooltip>

				<Button
					variant="outline"
					size="icon" // Use icon size on mobile for better fit
					className="rounded-md w-9 h-9 md:w-10 md:h-10"
					onClick={() => toggleSettings(true)}
				>
					<Settings size={18} />
				</Button>
			</div>
		</div>
	);
}
