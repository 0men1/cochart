import { useCallback, useEffect, useRef } from "react";
import { useChartStore } from "@/stores/useChartStore";
import { getCandleData, subscribeCandleData } from "@/core/chart/indicators/candleData";
import { createIndicator, destroyIndicator, LiveIndicator } from "@/core/chart/indicators/factory";
import { throttle } from "@/lib/throttle";
import { logger } from "@cochart/protocol";

// Reconciles the store's indicator configs with live chart series, mirroring how
// useChartDrawings reconciles drawings. Enabling a config creates its series and
// computes it over the current candle data; disabling/removing tears it down.
// Series are recomputed whenever the candle data changes (throttled) or the
// config collection updates (param edits, adds/removes).
export function useChartIndicators() {
  const chartApi = useChartStore((s) => s.chartApi);
  const indicators = useChartStore((s) => s.indicators);

  // Live series keyed by indicator id. Instances belong to the current chart;
  // when the chart is recreated (symbol/timeframe change) they die with it.
  const liveRef = useRef<Map<string, LiveIndicator>>(new Map());
  // Tracks chart identity so we can drop stale refs after a chart recreation.
  const lastChartRef = useRef<typeof chartApi>(null);

  // Recompute + re-feed every live indicator from the current candle data.
  const applyAll = useCallback(() => {
    const candles = getCandleData();
    const collection = useChartStore.getState().indicators.collection;
    for (const [id, live] of liveRef.current) {
      const config = collection.get(id);
      if (config) live.apply(candles, config.params);
    }
  }, []);

  // Reconcile series with the config collection whenever it changes (or the
  // chart instance changes).
  useEffect(() => {
    const live = liveRef.current;

    if (!chartApi) {
      // Chart gone (unmount / recreation): the series died with it, drop refs.
      live.clear();
      lastChartRef.current = null;
      return;
    }

    // Chart was recreated: previous series belonged to the removed chart, so
    // forget them and rebuild from scratch below.
    if (lastChartRef.current !== chartApi) {
      live.clear();
      lastChartRef.current = chartApi;
    }

    const collection = indicators.collection;

    // Track whether panes/series were added or removed so we can force a
    // relayout — the chart doesn't reflow removed panes on its own, leaving an
    // empty pane on screen until the next manual resize.
    let structuralChange = false;

    // Tear down indicators that were removed from the collection. Disabled
    // instances stay alive but hidden (below), like a drawing's visibility.
    for (const [id, inst] of Array.from(live.entries())) {
      if (!collection.has(id)) {
        destroyIndicator(chartApi, inst);
        live.delete(id);
        structuralChange = true;
      }
    }

    // Create instances that don't have live series yet.
    for (const config of collection.values()) {
      if (live.has(config.id)) continue;
      const inst = createIndicator(chartApi, config);
      if (inst) {
        live.set(config.id, inst);
        structuralChange = true;
      }
    }

    // Reconcile data, style, and visibility for every live instance (covers new
    // series, param/color edits, visibility toggles, and chart recreation).
    const candles = getCandleData();
    for (const [id, inst] of live) {
      const config = collection.get(id);
      if (!config) continue;
      inst.apply(candles, config.params);
      inst.applyStyle(config.style);
      inst.setVisible(config.enabled);
    }

    // Force the chart to recompute its pane layout after add/remove — otherwise
    // a deleted pane lingers on screen until the user drags a pane separator.
    // applyOptions({}) triggers a full model update, which redistributes pane
    // heights and repaints. resize() with the current size would short-circuit.
    if (structuralChange) {
      try {
        chartApi.applyOptions({});
      } catch (e) {
        logger.error("failed to relayout after indicator change:", e);
      }
    }
  }, [chartApi, indicators.collection, indicators.updatedAt, applyAll]);

  // Recompute when candle data changes (historical loads + live ticks). The live
  // path fires per tick, so throttle to avoid recomputing every frame.
  useEffect(() => {
    const throttled = throttle(() => applyAll(), 250);
    const unsub = subscribeCandleData(() => throttled());
    return () => {
      throttled.cancel();
      unsub();
    };
  }, [applyAll]);
}
