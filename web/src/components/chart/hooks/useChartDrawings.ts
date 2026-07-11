import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { TrendLine } from "@/core/chart/drawings/primitives/TrendLine";
import { VertLine } from "@/core/chart/drawings/primitives/VertLine";
import { HorizontalLine } from "@/core/chart/drawings/primitives/HorizontalLine";
import { Ray } from "@/core/chart/drawings/primitives/Ray";
import { Rectangle } from "@/core/chart/drawings/primitives/Rectangle";
import { FibonacciRetracement } from "@/core/chart/drawings/primitives/FibonacciRetracement";
import { DrawingOperation, SerializedDrawing } from "@/core/chart/drawings/types";
import { useCallback, useEffect, useRef } from "react";
import { getDrawings, setDrawings } from "@/lib/indexdb";
import { MouseEventParams } from "cochart-charts";
import { setCursor } from "@/core/chart/cursor";
import { useChartStore } from "@/stores/useChartStore";
import { useCollabStore } from "@/stores/useCollabStore";
import { DrawingType } from "@/core/chart/types";

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
    }
    if (restoredDrawing) {
      return restoredDrawing;
    }
  } catch (error) {
    console.error(`failed to restore drawing ${drawing.id}: `, error)
  }
  return null;
}

export function useChartDrawings() {
  const { id, drawings, tools, chartApi, seriesApi } = useChartStore();
  const { addDrawing, modifyDrawing, deleteDrawing, selectDrawing, cancelTool } = useChartStore();

  // While in a collab room the server snapshot is the sole source of truth, so
  // local IndexedDB restore/persist is paused (it must never merge into a room).
  const roomId = useCollabStore((s) => s.roomId);

  const isInitializedRef = useRef<string | null>(null);

  // Drawings whose store listeners are already subscribed. Instances survive
  // chart recreation, so re-attaching must not re-subscribe them.
  const wiredRef = useRef(new WeakSet<BaseDrawing>());

  const attachListeners = useCallback((drawing: BaseDrawing) => {
    drawing.subscribe(DrawingOperation.DELETE, () => {
      deleteDrawing(drawing.id);
    })
    drawing.subscribe(DrawingOperation.SELECT, () => {
      selectDrawing(drawing.id);
    })
    drawing.subscribe(DrawingOperation.MODIFY, () => {
      modifyDrawing(drawing);
    })
  }, [addDrawing, modifyDrawing, selectDrawing, drawings.selected])

  useEffect(() => {
    if (!seriesApi || roomId) return;
    let active = true;

    (async () => {
      if (!seriesApi || isInitializedRef.current === id || !active) return;
      const recovered = await getDrawings(id)

      // 2) restore + attach concrete instances immediately
      for (const sd of recovered) {
        const inst = restoreDrawing(sd);
        if (!inst) continue;
        addDrawing(inst);
      }

      // 3) mark init complete for this chart id
      isInitializedRef.current = id;
    })().catch(console.error);

    return () => {
      active = false;
      isInitializedRef.current = null;
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
      if (tools.activeHandler) {
        const inst = tools.activeHandler.onClick(param.point.x, param.point.y);
        if (inst && seriesApi) {
          seriesApi.attachPrimitive(inst);
          attachListeners(inst);
          wiredRef.current.add(inst);
          addDrawing(inst); // reducer should serialize internally
          cancelTool();
        }
        return;
      }
      const hoveredId = param.hoveredObjectId as string;
      const hit = drawings.collection.get(hoveredId);
      if (hit) {
        if (drawings.selected && hit.id !== drawings.selected) {
          drawings.collection.get(drawings.selected)?.setSelected(false);
        }
        hit.setSelected(true);
        selectDrawing(hit.id);
      } else if (drawings.selected) {
        drawings.collection.get(drawings.selected)?.setSelected(false);
        selectDrawing(null);
      }
    } catch (e) { console.error(e); }
  }, [tools.activeHandler, drawings, seriesApi]);

  const mouseMoveHandler = useCallback((param: MouseEventParams) => {
    try {
      if (!param.point || !param.logical) return;
      const hoveredId = param.hoveredObjectId as string;
      // Scope the cursor to the chart element so it can't leak onto the rest of
      // the UI. '' clears the inline cursor, falling back to the container's
      // `cursor-crosshair`; 'pointer' overrides it on a draggable drawing.
      const el = chartApi?.chartElement();
      if (el) setCursor(hoveredId ? 'pointer' : '', el);
    } catch (e) { console.error(e); }
  }, [tools.activeHandler, chartApi]);

  useEffect(() => {
    chartApi?.subscribeCrosshairMove(mouseMoveHandler);
    chartApi?.subscribeClick(mouseClickHandler);
    return () => {
      try {
        chartApi?.unsubscribeCrosshairMove(mouseMoveHandler);
        chartApi?.unsubscribeClick(mouseClickHandler);
      } catch (error) {
        console.error('Error during event cleanup (likely disposed chart):', error);
      }
    };
  }, [chartApi, mouseClickHandler, mouseMoveHandler]);
}
