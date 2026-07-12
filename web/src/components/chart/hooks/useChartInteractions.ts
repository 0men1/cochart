"use client"
import { useCallback, useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useCollabStore } from "@/stores/useCollabStore";
import { useChartStore } from "@/stores/useChartStore";

export function useChartInteraction() {
  const { toggleTickerSearch } = useUIStore();
  const { cancelTool, deselectDrawing, deleteDrawing, undo, redo } = useChartStore();

  const keyDownHandler = useCallback((event: KeyboardEvent) => {
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

    // Don't steal typing while a blocking prompt owns the screen.
    if (useCollabStore.getState().pendingSnapshot) {
      return;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      toggleTickerSearch(true, event.key);
    }
  }, [toggleTickerSearch])

  useEffect(() => {
    window.addEventListener('keydown', keyDownHandler)
    return () => {
      window.removeEventListener('keydown', keyDownHandler)
    }
  }, [keyDownHandler])
}
