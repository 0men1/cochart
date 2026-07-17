import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { logger } from "@/lib/logger";
import { restoreDrawing } from "@/core/chart/drawings/registry";
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

const PASTE_OFFSET_PX = { dx: 16, dy: -16 };

export function useChartDrawings() {
  const { id, drawings, tools, chartApi, seriesApi } = useChartStore();
  const { addDrawing, modifyDrawing, deleteDrawing, selectDrawing, selectOnly, cancelTool, deselectDrawing } = useChartStore();

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
      if (drawing.isSelected()) {
        for (const d of useChartStore.getState().drawings.collection.values()) {
          if (d.id !== drawing.id && d.isSelected()) d.setSelected(false);
        }
        selectDrawing(drawing.id);
      } else if (useChartStore.getState().drawings.selected === drawing.id) {
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
          selectOnly(inst.id);
        }
        return;
      }
      const hoveredId = param.hoveredObjectId as string;
      const hit = drawings.collection.get(hoveredId);

      if (hit) {
        selectOnly(hit.id);
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
      selectOnly(hit.id);
      openDrawingSettings(hit.id);
    } catch (e) { logger.error(e); }
  }, [drawings, selectOnly, openDrawingSettings]);

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
      if (tools.activeHandler) {
        applyHover(null);
        tools.activeHandler.onMove(param.point.x, param.point.y);
        if (el) setCursor('', el);
        return;
      }
      const hoveredId = (param.hoveredObjectId as string) ?? null;
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

    selectOnly(inst.id);
  }, [attachListeners, addDrawing, selectOnly]);

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
