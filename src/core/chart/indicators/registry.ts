// Single source of truth for indicator metadata: the label/icon/description
// shown in the Indicators dialog, whether the indicator overlays the price pane
// or gets its own pane, its default calculation params, and the editable param
// schema the settings UI renders. The chart-series creation for each type lives
// in factory.ts (it depends on the chart API); this file stays UI/plain-data.

import { Activity, BarChart3, Gauge, LineChart, TrendingUp, Waves, type LucideIcon } from "lucide-react";
import { IndicatorConfig, IndicatorParams, IndicatorType } from "./types";

export interface IndicatorParamField {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}

export interface IndicatorMeta {
  label: string;
  // Compact name for list rows (e.g. "SMA", "MACD").
  short: string;
  description: string;
  icon: LucideIcon;
  // 'overlay' draws on the price pane (pane 0); 'pane' gets a dedicated pane
  // below the price chart.
  placement: "overlay" | "pane";
  defaultParams: IndicatorParams;
  paramSchema: IndicatorParamField[];
  // Whether the instance exposes an editable line color. Volume is colored by
  // candle direction, so it opts out.
  supportsColor: boolean;
}

export const INDICATOR_META: Record<IndicatorType, IndicatorMeta> = {
  [IndicatorType.SMA]: {
    short: "SMA",
    label: "Simple Moving Average",
    description: "Average close over a rolling window.",
    icon: TrendingUp,
    placement: "overlay",
    defaultParams: { period: 20 },
    paramSchema: [{ key: "period", label: "Period", min: 1, max: 500 }],
    supportsColor: true,
  },
  [IndicatorType.EMA]: {
    short: "EMA",
    label: "Exponential Moving Average",
    description: "Moving average weighted toward recent bars.",
    icon: LineChart,
    placement: "overlay",
    defaultParams: { period: 20 },
    paramSchema: [{ key: "period", label: "Period", min: 1, max: 500 }],
    supportsColor: true,
  },
  [IndicatorType.VWAP]: {
    short: "VWAP",
    label: "VWAP",
    description: "Volume-weighted average price (cumulative).",
    icon: Waves,
    placement: "overlay",
    defaultParams: {},
    paramSchema: [],
    supportsColor: true,
  },
  [IndicatorType.RSI]: {
    short: "RSI",
    label: "Relative Strength Index",
    description: "Momentum oscillator, 0–100.",
    icon: Gauge,
    placement: "pane",
    defaultParams: { period: 14 },
    paramSchema: [{ key: "period", label: "Period", min: 2, max: 100 }],
    supportsColor: true,
  },
  [IndicatorType.MACD]: {
    short: "MACD",
    label: "MACD",
    description: "Moving-average convergence/divergence.",
    icon: Activity,
    placement: "pane",
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramSchema: [
      { key: "fast", label: "Fast", min: 1, max: 200 },
      { key: "slow", label: "Slow", min: 1, max: 400 },
      { key: "signal", label: "Signal", min: 1, max: 200 },
    ],
    supportsColor: true,
  },
  [IndicatorType.VOLUME]: {
    short: "Vol",
    label: "Volume",
    description: "Per-bar volume, colored by direction.",
    icon: BarChart3,
    placement: "pane",
    defaultParams: {},
    paramSchema: [],
    supportsColor: false,
  },
};

// Default line colors cycled as instances are added, so several indicators of
// the same type land on visually distinct colors out of the box.
export const INDICATOR_PALETTE = [
  "#2962FF", // blue
  "#E040FB", // magenta
  "#FF6D00", // orange
  "#00C853", // green
  "#FFB300", // amber
  "#00B8D4", // cyan
  "#D50000", // red
  "#7E57C2", // purple
];

export function nextIndicatorColor(index: number): string {
  return INDICATOR_PALETTE[index % INDICATOR_PALETTE.length];
}

// Compact row label including the instance's params, e.g. "SMA 20" or
// "MACD 12/26/9". Falls back to the short name when there are no params.
export function indicatorLabel(config: IndicatorConfig): string {
  const meta = INDICATOR_META[config.type];
  const nums = meta.paramSchema
    .map((f) => config.params[f.key])
    .filter((v): v is number => v !== undefined);
  return nums.length ? `${meta.short} ${nums.join("/")}` : meta.short;
}

// Stable display order for the dialog list.
export const INDICATOR_ORDER: IndicatorType[] = [
  IndicatorType.SMA,
  IndicatorType.EMA,
  IndicatorType.VWAP,
  IndicatorType.VOLUME,
  IndicatorType.RSI,
  IndicatorType.MACD,
];
