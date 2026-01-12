import { DrawingHandlerFactory } from "@/core/chart/drawings/DrawingHandlerFactory";
import { Button } from "../ui/button";
import { useChartStore } from "@/stores/useChartStore";
import { MoveDiagonal, MoveUp } from "lucide-react";
import { DrawingType } from "@/core/chart/types";

function Toolbox() {
	const activeTool = useChartStore((s) => s.tools.activeTool);
	const chartApi = useChartStore((s) => s.chartApi);
	const seriesApi = useChartStore((s) => s.seriesApi);

	const startTool = useChartStore((s) => s.startTool);
	const cancelTool = useChartStore((s) => s.cancelTool);

	const isReady = !!(chartApi && seriesApi);

	function setTool(tool: DrawingType) {
		if (!chartApi || !seriesApi) {
			console.warn("Chart API not ready yet");
			return;
		}

		if (tool === activeTool) {
			cancelTool();
			return;
		}

		try {
			const handlerFactory = new DrawingHandlerFactory(chartApi, seriesApi);
			const handler = handlerFactory.createHandler(tool);
			if (handler) {
				startTool(tool, handler);
			}
		} catch (error) {
			console.error("failed to set tool: ", error);
			cancelTool();
		}
	}

	const buttons = [
		{ tool: DrawingType.VERTICAL_LINE, icon: MoveUp, label: "Vertical Line" },
		{ tool: DrawingType.TREND_LINE, icon: MoveDiagonal, label: "Trendline" },
	];

	return (
		<div className="flex flex-col gap-1 py-2 px-1 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700">
			{buttons.map(({ tool, icon: Icon }) => {
				const isActive = activeTool === tool;
				return (
					<Button
						key={tool}
						variant="ghost"
						size="icon"
						disabled={!isReady} // Visually disable if chart isn't ready
						className={`h-9 w-9 rounded-lg transition-all ${isActive
							? 'bg-blue-600 text-white hover:bg-blue-700'
							: 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
						onClick={() => setTool(tool)}
						title={!isReady ? "Chart loading..." : undefined}
					>
						<Icon size={20} />
					</Button>
				);
			})}
		</div>
	);
};

export default Toolbox;
