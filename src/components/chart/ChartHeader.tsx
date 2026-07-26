import { LineChart, Layers, Settings, Share2, Users } from "lucide-react";
import { Button } from "../ui/button";
import { ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { useUIStore } from "@/stores/useUIStore";
import { useChartStore } from "@/stores/useChartStore";
import { useShallow } from "zustand/react/shallow";
import { Product } from "@/stores/types";
import { useCollabStore } from "@/stores/useCollabStore";

export default function ChartHeader() {
  const { toggleChartSettings, selectChart } = useChartStore(
    useShallow((s) => ({ toggleChartSettings: s.toggleChartSettings, selectChart: s.selectChart })),
  );
  const { product, timeframe } = useChartStore(
    useShallow((s) => ({ product: s.data.product, timeframe: s.data.timeframe })),
  );

  const { toggleTickerSearch } = useUIStore();
  const drawingManagerOpen = useUIStore((s) => s.drawingManager.isOpen);
  const toggleDrawingManager = useUIStore((s) => s.toggleDrawingManager);
  const indicatorManagerOpen = useUIStore((s) => s.indicatorManager.isOpen);
  const toggleIndicatorManager = useUIStore((s) => s.toggleIndicatorManager);
  const { status, roomId, toggleCollabWindow } = useCollabStore();

  const isInRoom = status === ConnectionStatus.CONNECTED && !!roomId;

  const timeframes: string[] = ["1m", "5m", "15m", "1H", "6H", "1D"];

  const handleChartUpdate = (product: Product, timeframe: IntervalKey) => {
    selectChart(product, timeframe);
  };

  return (
    <div className="flex justify-between items-center w-full h-10 px-2 bg-card border-b border-border">

      <div className="flex items-center min-w-0 flex-1 mr-2">
        <div className="flex items-center w-full">
          <Button
            variant="ghost"
            size="lg"
            className="text-base"
            onClick={() => toggleTickerSearch(true, product.name)}
          >
            {product.name}
          </Button>

          <div className="shrink-0 w-px h-4 bg-border mx-2" />

          <div className="flex items-center overflow-x-auto no-scrollbar">
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
              <Share2 size={16} />
            </>
          )}
        </Button>


        <Button
          variant="outline"
          size="icon"
          aria-label="Indicators"
          title="Indicators"
          className={`rounded-md w-9 h-9 md:w-10 md:h-8 ${indicatorManagerOpen ? 'bg-accent text-foreground' : ''}`}
          onClick={() => toggleIndicatorManager(!indicatorManagerOpen)}
        >
          <LineChart size={18} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Drawings"
          title="Drawings"
          className={`rounded-md w-9 h-9 md:w-10 md:h-8 ${drawingManagerOpen ? 'bg-accent text-foreground' : ''}`}
          onClick={() => toggleDrawingManager(!drawingManagerOpen)}
        >
          <Layers size={18} />
        </Button>

        <Button
          variant="outline"
          size="icon" // Use icon size on mobile for better fit
          className="rounded-md w-9 h-9 md:w-10 md:h-8"
          onClick={() => toggleChartSettings(true)}
        >
          <Settings size={18} />
        </Button>
      </div>
    </div>
  );
}
