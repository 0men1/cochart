import { CrosshairMode, LineStyle } from "cochart-charts";

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

}

export interface Product {
  symbol: string;
  name: string;
  exchange: string;
}

export enum CollabAction {
  INIT_ROOM = 'INIT_ROOM',
  SNAPSHOT = 'SNAPSHOT',
  SELECT_CHART = 'SELECT_CHART',
  ADD_DRAWING = 'ADD_DRAWING',
  DELETE_DRAWING = 'DELETE_DRAWING',
  MODIFY_DRAWING = 'MODIFY_DRAWING',
  ADD_INDICATOR = 'ADD_INDICATOR',
  MODIFY_INDICATOR = 'MODIFY_INDICATOR',
  REMOVE_INDICATOR = 'REMOVE_INDICATOR',
  PRESENCE = 'PRESENCE',
  UPDATE_PRESENCE = 'UPDATE_PRESENCE',
  CURSOR = 'CURSOR',
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
}
