// Turns an IndicatorConfig into live chart series. Each indicator type builds
// one or more built-in series (LineSeries / HistogramSeries) — overlays on the
// price pane, oscillators/volume in a dedicated pane — and returns an `apply`
// closure that recomputes and re-feeds those series from candle data. Keeping
// creation and update colocated per type means the reconcile hook only has to
// call create/apply/destroy without knowing each indicator's series layout.

import {
  HistogramSeries,
  IChartApi,
  IPaneApi,
  ISeriesApi,
  LineSeries,
  LineWidth,
  SeriesType,
  Time,
} from "cochart-charts";
import { Candlestick } from "@/core/chart/market-data/types";
import { logger } from "@cochart/protocol";
import * as calc from "./calculations";
import { IndicatorConfig, IndicatorParams, IndicatorStyle, IndicatorType } from "./types";

export interface LiveIndicator {
  series: ISeriesApi<SeriesType>[];
  pane: IPaneApi<Time> | null;
  apply: (candles: Candlestick[], params: IndicatorParams) => void;
  applyStyle: (style: IndicatorStyle) => void;
  setVisible: (visible: boolean) => void;
}

const MACD_SIGNAL = "#FF6D00";

const overlayLineOptions = (color: string) => ({
  color,
  lineWidth: 2 as LineWidth,
  priceLineVisible: false,
  lastValueVisible: true,
});

export function createIndicator(
  chart: IChartApi,
  config: IndicatorConfig,
): LiveIndicator | null {
  const color = config.style.color;
  try {
    switch (config.type) {
      case IndicatorType.SMA: {
        const line = chart.addSeries(LineSeries, overlayLineOptions(color), 0);
        return {
          series: [line],
          pane: null,
          apply: (candles, params) => line.setData(calc.sma(candles, params.period ?? 20)),
          applyStyle: (style) => line.applyOptions({ color: style.color }),
          setVisible: (visible) => line.applyOptions({ visible }),
        };
      }
      case IndicatorType.EMA: {
        const line = chart.addSeries(LineSeries, overlayLineOptions(color), 0);
        return {
          series: [line],
          pane: null,
          apply: (candles, params) => line.setData(calc.ema(candles, params.period ?? 20)),
          applyStyle: (style) => line.applyOptions({ color: style.color }),
          setVisible: (visible) => line.applyOptions({ visible }),
        };
      }
      case IndicatorType.VWAP: {
        const line = chart.addSeries(LineSeries, overlayLineOptions(color), 0);
        return {
          series: [line],
          pane: null,
          apply: (candles) => line.setData(calc.vwap(candles)),
          applyStyle: (style) => line.applyOptions({ color: style.color }),
          setVisible: (visible) => line.applyOptions({ visible }),
        };
      }
      case IndicatorType.VOLUME: {
        const pane = chart.addPane();
        const hist = chart.addSeries(
          HistogramSeries,
          { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "volume" } },
          pane.paneIndex(),
        );
        return {
          series: [hist],
          pane,
          apply: (candles) => hist.setData(calc.volume(candles)),
          // Volume bars are colored by candle direction; no user color.
          applyStyle: () => { },
          setVisible: (visible) => hist.applyOptions({ visible }),
        };
      }
      case IndicatorType.RSI: {
        const pane = chart.addPane();
        const line = chart.addSeries(LineSeries, { color, lineWidth: 2 as LineWidth, priceLineVisible: false }, pane.paneIndex());
        // Overbought / oversold guides.
        line.createPriceLine({ price: 70, color: "#787b86", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" });
        line.createPriceLine({ price: 30, color: "#787b86", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" });
        return {
          series: [line],
          pane,
          apply: (candles, params) => line.setData(calc.rsi(candles, params.period ?? 14)),
          applyStyle: (style) => line.applyOptions({ color: style.color }),
          setVisible: (visible) => line.applyOptions({ visible }),
        };
      }
      case IndicatorType.MACD: {
        const pane = chart.addPane();
        const paneIndex = pane.paneIndex();
        const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIndex);
        const macdLine = chart.addSeries(LineSeries, { color, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: false }, paneIndex);
        const signalLine = chart.addSeries(LineSeries, { color: MACD_SIGNAL, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: false }, paneIndex);
        return {
          series: [hist, macdLine, signalLine],
          pane,
          apply: (candles, params) => {
            const { macdLine: m, signalLine: s, histogram: h } = calc.macd(
              candles,
              params.fast ?? 12,
              params.slow ?? 26,
              params.signal ?? 9,
            );
            hist.setData(h);
            macdLine.setData(m);
            signalLine.setData(s);
          },
          // The user color drives the MACD line; signal and histogram keep their
          // conventional palette.
          applyStyle: (style) => macdLine.applyOptions({ color: style.color }),
          setVisible: (visible) => {
            hist.applyOptions({ visible });
            macdLine.applyOptions({ visible });
            signalLine.applyOptions({ visible });
          },
        };
      }
      default:
        return null;
    }
  } catch (e) {
    logger.error("failed to create indicator:", e);
    return null;
  }
}

// Remove an indicator's series and, if it owns a dedicated pane, that pane too.
export function destroyIndicator(chart: IChartApi, live: LiveIndicator) {
  for (const s of live.series) {
    try {
      chart.removeSeries(s);
    } catch (e) {
      logger.error("failed to remove indicator series:", e);
    }
  }
  if (live.pane) {
    try {
      const idx = chart.panes().indexOf(live.pane);
      if (idx > 0) chart.removePane(idx);
    } catch (e) {
      logger.error("failed to remove indicator pane:", e);
    }
  }
}
