import { CrosshairMode, LineStyle } from "cochart-charts";
import { DrawingType } from "@/core/chart/types";

export interface GridLineSettings {
  visible: boolean;
  color: string;
  style: LineStyle;
}

export interface CrosshairLineSettings {
  visible: boolean;
  color: string;
  width: number;
  style: LineStyle;
}

export interface ChartSettings {
  isOpen: boolean
  cursor: CrosshairMode;
  timezone: string;
  layout: {
    fontSize: number;
  };
  background: {
    theme: "dark" | "light";
    grid: {
      vertLines: GridLineSettings;
      horzLines: GridLineSettings;
    };
  };
  crosshair: {
    vertLine: CrosshairLineSettings;
    horzLine: CrosshairLineSettings;
  };
  candles: {
    upColor: string;
    downColor: string;
    wickVisible: boolean;
    wickupColor: string;
    wickDownColor: string;
    borderVisible: boolean;
    borderUpColor: string;
    borderDownColor: string;
  };
  // Number-key (1-9) hotkey per drawing tool; '' means unbound.
  hotkeys: Record<DrawingType, string>;
}

export interface Product {
  symbol: string;
  name: string;
  exchange: string;
}

// The collaboration wire types are shared with the server via @cochart/protocol
// (single source of truth). Re-exported so existing `@/stores/types` imports of
// CollabAction / PresenceUser / ChatMessage keep working unchanged.
export { CollabAction } from "@cochart/protocol";
export type { PresenceUser, ChatMessage } from "@cochart/protocol";
