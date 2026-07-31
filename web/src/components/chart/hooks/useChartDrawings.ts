import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { logger } from "@cochart/protocol";
import { restoreDrawing } from "@/core/chart/drawings/registry";
import { DrawingOperation, SerializedDrawing } from "@/core/chart/drawings/types";
import { Point } from "@/core/chart/types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getDrawings, setDrawings } from "@/lib/indexdb";
import { MouseEventParams, Coordinate } from "cochart-charts";
import { setCursor, type CursorType } from "@/core/chart/cursor";
import { pixelNudgeDeltas, shiftPoints } from "@/core/chart/drawings/clipboard";
import { setSelectedDrawingAccessor } from "@/core/chart/drawings/selectionPriority";
import { randomUUID } from "@/lib/utils";
import { useChartStore, suppressHistory } from "@/stores/useChartStore";
import { useShallow } from "zustand/react/shallow";
import { useCollabStore } from "@/stores/useCollabStore";
import { useUIStore } from "@/stores/useUIStore";
import { throttle } from "@/lib/throttle";

const PASTE_OFFSET_PX = { dx: 16, dy: -16 };
const DRAG_THROTTLE_MS = 40;
const DRAG_CREATE_THRESHOLD_PX = 5;

export function useChartDrawings() {
  const { id, drawings, tools, chartApi, seriesApi } = useChartStore(
    useShallow((s) => ({
      id: s.id,
      drawings: s.drawings,
      tools: s.tools,
      chartApi: s.chartApi,
      seriesApi: s.seriesApi,
    })),
  );
  const { addDrawing, modifyDrawing, deleteDrawing, selectDrawing, selectOnly, cancelTool, deselectDrawing } =
    useChartStore(
      useShallow((s) => ({
        addDrawing: s.addDrawing,
        modifyDrawing: s.modifyDrawing,
        deleteDrawing: s.deleteDrawing,
        selectDrawing: s.selectDrawing,
        selectOnly: s.selectOnly,
        cancelTool: s.cancelTool,
        deselectDrawing: s.deselectDrawing,
      })),
    );

  const roomId = useCollabStore((s) => s.roomId);
  const openDrawingSettings = useUIStore((s) => s.openDrawingSettings);
  const openDrawingContextMenu = useUIStore((s) => s.openDrawingContextMenu);
  const closeDrawingContextMenu = useUIStore((s) => s.closeDrawingContextMenu);
  const isInitializedRef = useRef<string | null>(null);
  const wiredRef = useRef(new WeakSet<BaseDrawing>());
  const hoveredRef = useRef<string | null>(null);
  const hoverFrameRef = useRef<number | null>(null);

  const clipboardRef = useRef<SerializedDrawing | null>(null);

  const sendDrag = useMemo(
    () =>
      throttle((drawingId: string, points: Point[]) => {
        useCollabStore.getState().broadcastDrawingDrag(drawingId, points);
      }, DRAG_THROTTLE_MS),
    [],
  );

  // Drop any pending drag broadcast when the hook tears down.
  useEffect(() => () => sendDrag.cancel(), [sendDrag]);

  useEffect(() => {
    setSelectedDrawingAccessor(() => {
      const { selected, collection } = useChartStore.getState().drawings;
      return selected ? collection.get(selected) ?? null : null;
    });
    return () => setSelectedDrawingAccessor(() => null);
  }, []);

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
    // Stream the in-progress position to peers while dragging (only in a room).
    drawing.subscribe(DrawingOperation.DRAG, () => {
      if (!useCollabStore.getState().roomId) return;
      const pts = drawing.getPreviewPoints();
      if (pts) sendDrag(drawing.id, pts);
    })
    drawing.subscribe(DrawingOperation.MODIFY, () => {
      // Drop any pending trailing drag so it can't land after this authoritative
      // commit (which peers treat as "drag over").
      sendDrag.cancel();
      modifyDrawing(drawing);
    })
  }, [addDrawing, modifyDrawing, selectDrawing, drawings.selected, sendDrag])

  const commitDrawing = useCallback((inst: BaseDrawing) => {
    const series = useChartStore.getState().seriesApi;
    if (!series) return;
    series.attachPrimitive(inst);
    attachListeners(inst);
    wiredRef.current.add(inst);
    addDrawing(inst);
    cancelTool();
    selectOnly(inst.id);
  }, [attachListeners, addDrawing, cancelTool, selectOnly]);

  useEffect(() => {
    if (!seriesApi) return;

    // In a collab room the server snapshot owns the drawings, so skip the local
    if (roomId) {
      isInitializedRef.current = null;
      return;
    }

    if (isInitializedRef.current === id) return;

    let active = true;
    (async () => {
      const recovered = await getDrawings(id);
      if (!active || isInitializedRef.current === id) return;

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

  useEffect(() => {
    if (!id || roomId || isInitializedRef.current !== id) return;
    const drawingsArray = Array.from(drawings.collection.values());
    setDrawings(id, drawingsArray);
  }, [id, drawings, drawings.updatedAt]);

  const mouseClickHandler = useCallback((param: MouseEventParams) => {
    try {
      if (!param.point || !param.logical) return;
      const hoveredId = param.hoveredObjectId as string;
      const hit = drawings.collection.get(hoveredId);
      if (hit) {
        selectOnly(hit.id);
      } else {
        deselectDrawing();
      }
    } catch (e) { logger.error(e); }
  }, [drawings, selectOnly, deselectDrawing]);

  // Double-clicking a drawing opens its dedicated settings page
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
        if (el) setCursor('', el);
        return;
      }
      const hoveredId = (param.hoveredObjectId as string) ?? null;
      applyHover(hoveredId);
      let cursor: CursorType | '' = '';
      if (hoveredId) {
        const hit = drawings.collection.get(hoveredId);
        const overControlPoint = !!hit && hit.getControlPointsAt(param.point.x, param.point.y) !== null;
        cursor = overControlPoint ? 'grab' : 'move';
      }
      if (el) setCursor(cursor, el);
    } catch (e) { logger.error(e); }
  }, [tools.activeHandler, chartApi, applyHover, drawings]);


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
    if (!chartApi || !seriesApi) return;
    let el: HTMLElement | null = null;
    try { el = chartApi.chartElement(); } catch { return; }
    if (!el) return;
    const element = el;

    // Client pixels -> chart pane coords. Valid for the default right-price-scale
    // layout (no left scale), where the pane's top-left is the element's top-left.
    const paneCoords = (e: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      return { x: (e.clientX - rect.left) as Coordinate, y: (e.clientY - rect.top) as Coordinate };
    };

    // Anchor (client px) of the current gesture, or null when not drawing.
    let downPt: { cx: number; cy: number } | null = null;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      const handler = useChartStore.getState().tools.activeHandler;
      if (!handler) return;                  // no tool → let the library pan/select
      if (e.button !== 0 || !e.isPrimary) return;
      // Block the library's pan and its synthetic click for this gesture.
      e.preventDefault();
      e.stopPropagation();
      try { element.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      downPt = { cx: e.clientX, cy: e.clientY };
      dragging = false;
      const { x, y } = paneCoords(e);
      try {
        const inst = handler.onClick(x, y);
        if (inst) { commitDrawing(inst); downPt = null; }
      } catch (err) { logger.error(err); }
    };

    const onPointerMove = (e: PointerEvent) => {
      const handler = useChartStore.getState().tools.activeHandler;
      if (!handler) { downPt = null; return; }  // no tool → library owns hover/pan
      const { x, y } = paneCoords(e);
      if (downPt) {
        e.preventDefault();
        e.stopPropagation();
        if (!dragging && Math.hypot(e.clientX - downPt.cx, e.clientY - downPt.cy) > DRAG_CREATE_THRESHOLD_PX) {
          dragging = true;
        }
      }
      try { handler.onMove(x, y); } catch (err) { logger.error(err); }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!downPt) return;
      const handler = useChartStore.getState().tools.activeHandler;
      e.preventDefault();
      e.stopPropagation();
      try { element.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      const wasDragging = dragging;
      const { x, y } = paneCoords(e);
      downPt = null;
      dragging = false;
      if (!handler) return;
      if (wasDragging && handler.requiredPoints === 2) {
        try {
          const inst = handler.onClick(x, y);
          if (inst) commitDrawing(inst);
        } catch (err) { logger.error(err); }
      }
    };

    element.addEventListener('pointerdown', onPointerDown, true);
    element.addEventListener('pointermove', onPointerMove, true);
    element.addEventListener('pointerup', onPointerUp, true);
    element.addEventListener('pointercancel', onPointerUp, true);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown, true);
      element.removeEventListener('pointermove', onPointerMove, true);
      element.removeEventListener('pointerup', onPointerUp, true);
      element.removeEventListener('pointercancel', onPointerUp, true);
    };
  }, [chartApi, seriesApi, commitDrawing]);

  // Right-click a drawing to open its context menu. The drawing under the cursor
  // is whatever is currently hovered (hoveredRef, kept fresh by crosshair-move).
  useEffect(() => {
    if (!chartApi) return;
    let element: HTMLElement | null = null;
    try { element = chartApi.chartElement(); } catch { return; }
    if (!element) return;
    const el = element;

    const onContextMenu = (e: MouseEvent) => {
      // A drawing tool is mid-placement — don't hijack the right-click.
      if (useChartStore.getState().tools.activeHandler) return;
      const id = hoveredRef.current;
      if (!id || !useChartStore.getState().drawings.collection.has(id)) {
        closeDrawingContextMenu();
        return; // empty chart → leave the native menu alone
      }
      e.preventDefault();
      selectOnly(id);
      openDrawingContextMenu({ x: e.clientX, y: e.clientY, drawingId: id });
    };

    el.addEventListener('contextmenu', onContextMenu);
    return () => el.removeEventListener('contextmenu', onContextMenu);
  }, [chartApi, selectOnly, openDrawingContextMenu, closeDrawingContextMenu]);

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
