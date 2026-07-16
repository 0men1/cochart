import { DrawingHandlerFactory } from "@/core/chart/drawings/DrawingHandlerFactory";
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore } from "@/stores/useChartStore";
import { MoveDiagonal, MoveUp, Minus, MoveUpRight, RectangleHorizontal, AlignJustify, Type, Pencil } from "lucide-react";
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
      logger.warn("Chart API not ready yet");
      return;
    }

    if (tool === activeTool) {
      cancelTool();
      return;
    }

    try {
      // Freehand isn't a click-to-place tool — it's captured by dragging in
      // useChartDrawings, so just activate it without a click handler.
      if (tool === DrawingType.FREEHAND) {
        startTool(tool, null);
        return;
      }
      const handlerFactory = new DrawingHandlerFactory(chartApi, seriesApi);
      const handler = handlerFactory.createHandler(tool);
      if (handler) {
        startTool(tool, handler);
      }
    } catch (error) {
      logger.error("failed to set tool: ", error);
      cancelTool();
    }
  }

  const buttons = [
    { tool: DrawingType.VERTICAL_LINE, icon: MoveUp, label: "Vertical Line" },
    { tool: DrawingType.HORIZONTAL_LINE, icon: Minus, label: "Horizontal Line" },
    { tool: DrawingType.TREND_LINE, icon: MoveDiagonal, label: "Trendline" },
    { tool: DrawingType.RAY, icon: MoveUpRight, label: "Ray" },
    { tool: DrawingType.RECTANGLE, icon: RectangleHorizontal, label: "Rectangle" },
    { tool: DrawingType.FIBONACCI, icon: AlignJustify, label: "Fib Retracement" },
    { tool: DrawingType.TEXT, icon: Type, label: "Text" },
    { tool: DrawingType.FREEHAND, icon: Pencil, label: "Pencil" },
  ];

  return (
    <div className="flex flex-col px-1 py-1 bg-card border-r border-border">
      {buttons.map(({ tool, icon: Icon, label }) => {
        const isActive = activeTool === tool;
        return (
          <Tooltip key={tool}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!isReady} // Visually disable if chart isn't ready
                className={`h-8 w-8 transition-all ${isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setTool(tool)}
              >
                <Icon size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {!isReady ? "Chart loading..." : label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default Toolbox;
