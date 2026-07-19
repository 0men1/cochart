"use client"
import { useCallback, useEffect } from "react";
import { CrosshairMode } from "cochart-charts";
import { useUIStore } from "@/stores/useUIStore";
import { useChartStore } from "@/stores/useChartStore";
import { isSnapEnabled, setSnapEnabled } from "@/core/chart/snap";

export function useChartInteraction() {
  const { toggleTickerSearch } = useUIStore();
  const { cancelTool, deselectDrawing, deleteDrawing, undo, redo } = useChartStore();

  // Cmd (Mac) / Ctrl toggles "magnet" snapping: drawing control points snap to
  // candle OHLC. We also flip the crosshair to MagnetOHLC so the visual aid
  // matches; when off we restore the user's configured cursor mode.
  const syncSnap = useCallback((active: boolean) => {
    if (isSnapEnabled() === active) return;
    setSnapEnabled(active);
    const { chartApi, chartSettings } = useChartStore.getState();
    chartApi?.applyOptions({
      crosshair: { mode: active ? CrosshairMode.MagnetOHLC : chartSettings.cursor },
    });
  }, []);

  const keyDownHandler = useCallback((event: KeyboardEvent) => {
    syncSnap(event.metaKey || event.ctrlKey);

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Abort an in-progress drawing (clears the preview and deactivates the tool).
    if (event.key === 'Escape') {
      deselectDrawing();
      cancelTool();
      return;
    }

    // Undo / redo — handled before the modifier-key early return below.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    // Delete the selected drawing (guard so Backspace doesn't navigate back).
    // Call deleteDrawing directly rather than a wrapper that nests set() calls.
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = useChartStore.getState().drawings.selected;
      if (selected) {
        event.preventDefault();
        deleteDrawing(selected);
      }
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      toggleTickerSearch(true, event.key);
    }
  }, [toggleTickerSearch, syncSnap])

  // Release the magnet as soon as the modifier is let go, or when the window
  // loses focus (e.g. Cmd+Tab) so it can't get stuck on.
  const keyUpHandler = useCallback((event: KeyboardEvent) => {
    syncSnap(event.metaKey || event.ctrlKey);
  }, [syncSnap]);

  const blurHandler = useCallback(() => syncSnap(false), [syncSnap]);

  useEffect(() => {
    window.addEventListener('keydown', keyDownHandler)
    window.addEventListener('keyup', keyUpHandler)
    window.addEventListener('blur', blurHandler)
    return () => {
      window.removeEventListener('keydown', keyDownHandler)
      window.removeEventListener('keyup', keyUpHandler)
      window.removeEventListener('blur', blurHandler)
    }
  }, [keyDownHandler, keyUpHandler, blurHandler])
}
