export enum IndicatorType {
  SMA = "SMA",
  EMA = "EMA",
  VWAP = "VWAP",
  RSI = "RSI",
  MACD = "MACD",
  VOLUME = "VOLUME",
}

// Numeric calculation parameters keyed by name (e.g. { period: 20 } or
// { fast: 12, slow: 26, signal: 9 }). Kept flat and numeric so the settings UI
// can render a generic input per entry.
export type IndicatorParams = Record<string, number>;

// Per-instance visual style. `color` applies to the indicator's primary line
// (indicators without a user color, like Volume, ignore it).
export interface IndicatorStyle {
  color: string;
}

// A single indicator instance on the chart. Users can add any number of these —
// including several of the same type with different params/colors — so `id` is
// what identifies an instance, not `type`.
export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: IndicatorParams;
  style: IndicatorStyle;
  enabled: boolean;
}
