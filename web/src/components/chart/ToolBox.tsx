import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore } from "@/stores/useChartStore";
import { DrawingType } from "@/core/chart/types";
import { DRAWING_TYPE_META } from "./drawingMeta";

function Toolbox() {
  const activeTool = useChartStore((s) => s.tools.activeTool);
  const chartApi = useChartStore((s) => s.chartApi);
  const seriesApi = useChartStore((s) => s.seriesApi);
  const activateTool = useChartStore((s) => s.activateTool);

  const isReady = !!(chartApi && seriesApi);

  // Toggle-activate; the store's activateTool owns the factory/cancel logic so
  // the toolbar and number hotkeys share one path.
  function setTool(tool: DrawingType) {
    activateTool(tool);
  }

  const toolOrder: DrawingType[] = [
    DrawingType.VERTICAL_LINE,
    DrawingType.HORIZONTAL_LINE,
    DrawingType.TREND_LINE,
    DrawingType.RAY,
    DrawingType.RECTANGLE,
    DrawingType.TRIANGLE,
    DrawingType.FIBONACCI,
    DrawingType.TEXT,
  ];
  const buttons = toolOrder.map((tool) => ({
    tool,
    icon: DRAWING_TYPE_META[tool].icon,
    label: DRAWING_TYPE_META[tool].label,
  }));

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
