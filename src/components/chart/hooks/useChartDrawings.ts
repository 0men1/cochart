import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { logger } from "@/lib/logger";
import { TrendLine } from "@/core/chart/drawings/primitives/TrendLine";
import { VertLine } from "@/core/chart/drawings/primitives/VertLine";
import { HorizontalLine } from "@/core/chart/drawings/primitives/HorizontalLine";
import { Ray } from "@/core/chart/drawings/primitives/Ray";
import { Rectangle } from "@/core/chart/drawings/primitives/Rectangle";
import { FibonacciRetracement } from "@/core/chart/drawings/primitives/FibonacciRetracement";
import { TextLabel } from "@/core/chart/drawings/primitives/TextLabel";
import { DrawingOperation, SerializedDrawing } from "@/core/chart/drawings/types";
import { useCallback, useEffect, useRef } from "react";
import { getDrawings, setDrawings } from "@/lib/indexdb";
import { MouseEventParams } from "cochart-charts";
import { setCursor } from "@/core/chart/cursor";
import { pixelNudgeDeltas, shiftPoints } from "@/core/chart/drawings/clipboard";
import { randomUUID } from "@/lib/utils";
import { useChartStore, suppressHistory } from "@/stores/useChartStore";
import { useCollabStore } from "@/stores/useCollabStore";
import { useUIStore } from "@/stores/useUIStore";
import { DrawingType } from "@/core/chart/types";

// Screen-space nudge (pixels) applied to a pasted clone so it lands visibly
// offset from the original — a little to the right and up.
const PASTE_OFFSET_PX = { dx: 16, dy: -16 };

/**
 * This hook will be solely responsible for drawing and removing and storing drawings
 */
export function restoreDrawing(drawing: SerializedDrawing): BaseDrawing | null {
  try {
    let restoredDrawing: BaseDrawing | null = null;
    switch (drawing.type) {
      case DrawingType.VERTICAL_LINE:
        restoredDrawing = new VertLine(drawing.points, drawing.options, drawing.id)
        break;
      case DrawingType.TREND_LINE:
        restoredDrawing = new TrendLine(drawing.points, drawing.options, drawing.id);
        break;
      case DrawingType.HORIZONTAL_LINE:
        restoredDrawing = new HorizontalLine(drawing.points, drawing.options, drawing.id);
        break;
      case DrawingType.RAY:
        restoredDrawing = new Ray(drawing.points, drawing.options, drawing.id);
        break;
      case DrawingType.RECTANGLE:
        restoredDrawing = new Rectangle(drawing.points, drawing.options, drawing.id);
        break;
      case DrawingType.FIBONACCI:
        restoredDrawing = new FibonacciRetracement(drawing.points, drawing.options, drawing.id);
        break;
      case DrawingType.TEXT:
        restoredDrawing = new TextLabel(drawing.points, drawing.options, drawing.id);
        break;
    }
    if (restoredDrawing) {
      return restoredDrawing;
    }
  } catch (error) {
    logger.error(`failed to restore drawing ${drawing.id}: `, error)
  }
  return null;
}

export function useChartDrawings() {
  const { id, drawings, tools, chartApi, seriesApi } = useChartStore();
  const { addDrawing, modifyDrawing, deleteDrawing, selectDrawing, cancelTool, deselectDrawing } = useChartStore();

  // While in a collab room the server snapshot is the sole source of truth, so
  // local IndexedDB restore/persist is paused (it must never merge into a room).
  const roomId = useCollabStore((s) => s.roomId);
  const openDrawingSettings = useUIStore((s) => s.openDrawingSettings);

  const isInitializedRef = useRef<string | null>(null);

  // Drawings whose store listeners are already subscribed. Instances survive
  // chart recreation, so re-attaching must not re-subscribe them.
  const wiredRef = useRef(new WeakSet<BaseDrawing>());

  // Id of the drawing currently under the cursor, so we can clear its hover
  // highlight when the cursor moves off it.
  const hoveredRef = useRef<string | null>(null);
  // Pending hover-repaint frame. Hover is applied on an animation frame (outside
  // the crosshair-move dispatch) so the repaint isn't coalesced away — a lone
  // update fired synchronously inside the dispatch was being dropped, leaving
  // control points stuck on screen.
  const hoverFrameRef = useRef<number | null>(null);

  const attachListeners = useCallback((drawing: BaseDrawing) => {
    drawing.subscribe(DrawingOperation.DELETE, () => {
      deleteDrawing(drawing.id);
    })
    drawing.subscribe(DrawingOperation.SELECT, () => {
      // Enforce exclusive selection at the single point every selection change
      // flows through. This covers selecting by click AND by grabbing another
      // drawing's control point to drag it (onDragStart -> setSelected(true)),
      // which the click handler never sees — so the previously selected drawing
      // is turned off immediately instead of lingering until you click away.
      if (drawing.isSelected()) {
        for (const d of useChartStore.getState().drawings.collection.values()) {
          if (d.id !== drawing.id && d.isSelected()) d.setSelected(false);
        }
        selectDrawing(drawing.id);
      } else if (useChartStore.getState().drawings.selected === drawing.id) {
        // This drawing was deselected; its instance flag is already off, so just
        // clear the store id (no setSelected -> no re-entrant notify loop).
        selectDrawing(null);
      }
    })
    drawing.subscribe(DrawingOperation.MODIFY, () => {
      modifyDrawing(drawing);
    })
  }, [addDrawing, modifyDrawing, selectDrawing, drawings.selected])

  useEffect(() => {
    if (!seriesApi) return;

    // In a collab room the server snapshot owns the drawings, so skip the local
    // restore — but mark it not-done so LEAVING the room re-restores from IndexedDB.
    if (roomId) {
      isInitializedRef.current = null;
      return;
    }

    // Restore exactly once per ticker id. Do NOT key this on seriesApi: switching
    // timeframe (or any chart recreation) produces a new series but must not
    // re-run the restore, or every drawing gets a duplicate instance ("clone")
    // that lingers attached to the series while orphaned from the collection.
    if (isInitializedRef.current === id) return;

    let active = true;
    (async () => {
      const recovered = await getDrawings(id);
      // Bail if superseded (dep change) or another run already restored this id.
      if (!active || isInitializedRef.current === id) return;

      // Suppressed so a page load doesn't fill the undo stack with the restores.
      suppressHistory(() => {
        for (const sd of recovered) {
          const inst = restoreDrawing(sd);
          if (!inst) continue;
          addDrawing(inst);
        }
      });

      isInitializedRef.current = id;
    })().catch(logger.error);

    return () => {
      active = false;
    };
  }, [id, seriesApi, roomId]);

  // Reconcile the collection against the CURRENT series. `isAttached` alone is
  // not enough: chart.remove() never calls detached() on series primitives, so
  // after a chart recreation drawings still claim to be attached — to a dead
  // series. Comparing series identity catches both never-attached (undefined)
  // and stale-series drawings.
  useEffect(() => {
    if (!seriesApi) return;
    let dirty = false;
    for (const drawing of drawings.collection.values()) {
      if (drawing.series !== seriesApi) {
        seriesApi.attachPrimitive(drawing);
        if (!wiredRef.current.has(drawing)) {
          attachListeners(drawing);
          wiredRef.current.add(drawing);
        }
        dirty = true;
      }
    }
    if (dirty) seriesApi.applyOptions(seriesApi.options());
  }, [drawings.collection, drawings.updatedAt, seriesApi])

  // persist when collection changes, only after initialization for this id
  // (skipped while in a room — the room snapshot owns the truth there)
  useEffect(() => {
    if (!id || roomId || isInitializedRef.current !== id) return;
    const drawingsArray = Array.from(drawings.collection.values());
    setDrawings(id, drawingsArray);
  }, [id, drawings, drawings.updatedAt]);

  const mouseClickHandler = useCallback((param: MouseEventParams) => {
    try {
      if (!param.point || !param.logical) return;
      // The pencil owns its own pointer capture; a stray click must not select
      // or place anything while it's active.
      if (tools.activeHandler) {
        const inst = tools.activeHandler.onClick(param.point.x, param.point.y);
        if (inst && seriesApi) {
          seriesApi.attachPrimitive(inst);
          attachListeners(inst);
          wiredRef.current.add(inst);
          addDrawing(inst); // reducer should serialize internally
          cancelTool();
          // Drop the freshly placed drawing straight into edit mode so its
          // editor opens instead of it being silently placed. Clear any other
          // selected drawing based on its own flag (not the store's id).
          for (const d of drawings.collection.values()) {
            if (d.id !== inst.id && d.isSelected()) d.setSelected(false);
          }
          inst.setSelected(true);
          selectDrawing(inst.id);
        }
        return;
      }
      const hoveredId = param.hoveredObjectId as string;
      const hit = drawings.collection.get(hoveredId);

      // Deselect every OTHER drawing based on its own live `isSelected()` flag —
      // the source of truth for control-point rendering. Relying on the store's
      // `selected` id (from this memoized closure) could leave a previously
      // selected drawing's control points stuck when clicking straight onto a
      // different drawing.
      for (const d of drawings.collection.values()) {
        if (d.id !== hit?.id && d.isSelected()) d.setSelected(false);
      }

      if (hit) {
        hit.setSelected(true);
        selectDrawing(hit.id);
      } else {
        deselectDrawing();
      }
    } catch (e) { logger.error(e); }
  }, [tools.activeHandler, drawings, seriesApi]);

  // Double-clicking a drawing opens its dedicated settings page. Resolve the
  // target the same way a single click does (via the library's hoveredObjectId)
  // and keep selection in sync so the drawing stays highlighted behind the modal.
  const mouseDblClickHandler = useCallback((param: MouseEventParams) => {
    try {
      const hoveredId = param.hoveredObjectId as string | undefined;
      if (!hoveredId) return;
      const hit = drawings.collection.get(hoveredId);
      if (!hit) return;
      for (const d of drawings.collection.values()) {
        if (d.id !== hit.id && d.isSelected()) d.setSelected(false);
      }
      hit.setSelected(true);
      selectDrawing(hit.id);
      openDrawingSettings(hit.id);
    } catch (e) { logger.error(e); }
  }, [drawings, selectDrawing, openDrawingSettings]);

  // Point the hover highlight at `targetId` (or null). The actual flag flip +
  // repaint is batched onto an animation frame so it runs OUTSIDE the
  // crosshair-move dispatch — a repaint requested synchronously inside that
  // dispatch gets coalesced away, which left control points stuck on screen.
  // Every drawing is set each frame (self-healing), then one reliable repaint.
  const applyHover = useCallback((targetId: string | null) => {
    if (hoveredRef.current === targetId) return;
    hoveredRef.current = targetId;
    if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const { drawings: d, seriesApi: s } = useChartStore.getState();
      for (const drawing of d.collection.values()) {
        drawing.setHovered(drawing.id === hoveredRef.current);
      }
      try { s?.applyOptions(s.options()); } catch (e) { logger.error(e); }
    });
  }, []);

  const mouseMoveHandler = useCallback((param: MouseEventParams) => {
    try {
      // Cursor left the chart pane — drop any hover highlight.
      if (!param.point || !param.logical) { applyHover(null); return; }
      const el = chartApi?.chartElement();

      // While placing a drawing, drive the live preview and keep the crosshair
      // cursor — the hoverable preview primitive would otherwise flip us to
      // 'pointer' mid-draw.
      if (tools.activeHandler) {
        applyHover(null);
        tools.activeHandler.onMove(param.point.x, param.point.y);
        if (el) setCursor('', el);
        return;
      }

      const hoveredId = (param.hoveredObjectId as string) ?? null;
      // Show control points under the cursor; they disappear when it moves away
      // (a still-selected drawing keeps them).
      applyHover(hoveredId);

      // Scope the cursor to the chart element so it can't leak onto the rest of
      // the UI. '' clears the inline cursor, falling back to the container's
      // `cursor-crosshair`; 'pointer' overrides it on a draggable drawing.
      if (el) setCursor(hoveredId ? 'pointer' : '', el);
    } catch (e) { logger.error(e); }
  }, [tools.activeHandler, chartApi, applyHover]);

  // Serialized copy of the drawing captured by Cmd/Ctrl-C, reused by Cmd/Ctrl-V.
  const clipboardRef = useRef<SerializedDrawing | null>(null);

  // Copy the selected drawing into the in-hook clipboard. Returns whether there
  // was a selection to copy, so the key handler knows if it owned the event.
  const copySelectedDrawing = useCallback((): boolean => {
    const { selected, collection } = useChartStore.getState().drawings;
    if (!selected) return false;
    const drawing = collection.get(selected);
    if (!drawing) return false;
    clipboardRef.current = drawing.serialize();
    return true;
  }, []);

  // Paste the clipboard as a brand-new drawing (fresh id) nudged off the
  // original, then run the same lifecycle as placing a fresh drawing: attach,
  // wire listeners, record/broadcast via addDrawing, and select it so its
  // editor opens.
  const pasteDrawing = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.points.length === 0) return;
    const { seriesApi: series, chartApi: chart } = useChartStore.getState();
    if (!series) return;

    let points = clip.points;
    if (chart) {
      const deltas = pixelNudgeDeltas(chart, series, clip.points[0], PASTE_OFFSET_PX.dx, PASTE_OFFSET_PX.dy);
      if (deltas) points = shiftPoints(clip.points, deltas.timeDelta, deltas.priceDelta);
    }

    const inst = restoreDrawing({ ...clip, id: randomUUID(), points, isDeleted: false });
    if (!inst) return;

    series.attachPrimitive(inst);
    attachListeners(inst);
    wiredRef.current.add(inst);
    addDrawing(inst);

    for (const d of useChartStore.getState().drawings.collection.values()) {
      if (d.id !== inst.id && d.isSelected()) d.setSelected(false);
    }
    inst.setSelected(true);
    selectDrawing(inst.id);
  }, [attachListeners, addDrawing, selectDrawing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      // Never hijack copy/paste while the user is typing in a field.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (key === 'c') {
        if (copySelectedDrawing()) event.preventDefault();
      } else if (key === 'v') {
        if (clipboardRef.current) {
          event.preventDefault();
          pasteDrawing();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copySelectedDrawing, pasteDrawing]);

  useEffect(() => {
    chartApi?.subscribeCrosshairMove(mouseMoveHandler);
    chartApi?.subscribeClick(mouseClickHandler);
    chartApi?.subscribeDblClick(mouseDblClickHandler);
    return () => {
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      try {
        chartApi?.unsubscribeCrosshairMove(mouseMoveHandler);
        chartApi?.unsubscribeClick(mouseClickHandler);
        chartApi?.unsubscribeDblClick(mouseDblClickHandler);
      } catch (error) {
        logger.error('Error during event cleanup (likely disposed chart):', error);
      }
    };
  }, [chartApi, mouseClickHandler, mouseMoveHandler, mouseDblClickHandler]);
}
