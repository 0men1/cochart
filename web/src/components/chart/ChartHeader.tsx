import { Settings, Share2, Users, Wifi } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { useUIStore } from "@/stores/useUIStore";
import { useChartStore } from "@/stores/useChartStore";
import { Product } from "@/stores/types";
import { useCollabStore } from "@/stores/useCollabStore";


function getStatusDiv(status: ConnectionStatus) {
	switch (status) {
		case ConnectionStatus.CONNECTED:
			return (<span className="text-live">●</span>)
		case ConnectionStatus.DISCONNECTED:
			return (<span className="text-destructive">●</span>)
		case ConnectionStatus.CONNECTING:
			break;
		case ConnectionStatus.ERROR:
			break;
		case ConnectionStatus.RECONNECTING:
			return (<span className="text-yellow-500">●</span>)
	}
}

export default function ChartHeader() {
	const { toggleChartSettings } = useChartStore();

	const { product, timeframe } = useChartStore().data;
	const { data, selectChart } = useChartStore();

	const { toggleTickerSearch } = useUIStore();
	const { status, roomId, toggleCollabWindow } = useCollabStore();

	const isInRoom = status === ConnectionStatus.CONNECTED && !!roomId;

	const timeframes: string[] = ["1m", "5m", "15m", "1H", "6H", "1D"];

	const handleChartUpdate = (product: Product, timeframe: IntervalKey) => {
		selectChart(product, timeframe);
	};

	return (
		<div className="flex justify-between items-center w-full h-12 px-2 md:px-4 bg-card border-b border-border">
			<div className="flex items-center min-w-0 flex-1 mr-2">
				<div className="flex items-center gap-1 w-full">
					<Button
						variant="ghost"
						size="sm"
						className="shrink-0 font-semibold text-base h-8 px-2.5"
						onClick={() => toggleTickerSearch(true, product.name)}
					>
						{product.name}
					</Button>

					<div className="shrink-0 w-px h-4 bg-border mx-2" />

					<div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
						{timeframes.map((time) => (
							<Button
								key={time}
								variant="ghost"
								size="sm"
								onClick={() => handleChartUpdate(product, time as IntervalKey)}
								className={`shrink-0 h-8 px-3 text-xs font-medium transition-colors ${time === timeframe ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`} >
								{time}
							</Button>
						))}
					</div>
				</div>
			</div>


			<div className="flex items-center gap-2 md:gap-4 shrink-0">
				<Button
					onClick={() => { toggleCollabWindow(true) }}
					className={isInRoom ? "bg-live text-live-foreground hover:bg-live/90 relative" : ""}
					size="sm" >
					{isInRoom ? (
						<>
							<Users size={16} className="md:mr-2" />
							<span className="hidden md:inline">Live</span>
							<span className="absolute -top-1 -right-1 w-3 h-3 bg-live rounded-full animate-pulse" />
						</>
					) : (
						<>
							<Share2 size={16} className="md:mr-2" />
							<span className="hidden md:inline">Share</span>
						</>
					)}
				</Button>

				{/* Connection Status Icon with Tooltip */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon" className="h-9 w-9">
							<Wifi size={18} className="text-muted-foreground" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="p-3 max-w-xs">
						<div className="space-y-2">
							<h4 className="font-semibold text-sm">Connection Status</h4>
							<div className="space-y-1 text-xs">
								<div className="flex items-center justify-between">
									<span>Collab Connection:</span>
									{getStatusDiv(status)}
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
					onClick={() => toggleChartSettings(true)}
				>
					<Settings size={18} />
				</Button>
			</div>
		</div>
	);
}
