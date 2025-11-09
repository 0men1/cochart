import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { TrendLine } from "@/core/chart/drawings/primitives/TrendLine";
import { VertLine } from "@/core/chart/drawings/primitives/VertLine";
import { SerializedDrawing } from "@/core/chart/drawings/types";
import { useApp } from "@/components/chart/context";
import { useCallback, useEffect, useRef } from "react";
import { getDrawings, setDrawings } from "@/lib/indexdb";
import { MouseEventParams } from "lightweight-charts";
import { setCursor } from "@/core/chart/cursor";
/**
 * This hook will be solely responsible for drawing and removing and storing drawings
 */
export function restoreDrawing(drawing: SerializedDrawing): BaseDrawing | null {
    try {
        let restoredDrawing: BaseDrawing | null = null;
        switch (drawing.type) {
            case "TrendLine":
                restoredDrawing = new TrendLine(drawing.points, drawing.options, drawing.id);
                break;
            case "VertLine":
                restoredDrawing = new VertLine(drawing.points, drawing.options, drawing.id)
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
    const { state, action } = useApp();
    const { chartApi, seriesApi } = state.chart;
    const drawingsRef = useRef<Map<string, BaseDrawing>>(new Map());
    const isInitializedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!seriesApi) return;
        let active = true;
        const currentId = state.chart.id;
        (async () => {
            if (isInitializedRef.current === currentId) return;
            const recovered = await getDrawings(currentId);
            if (!active) return;

            // 1) put serialized snapshots into state (for persistence/UI)
            action.initializeDrawings(recovered);

            // 2) restore + attach concrete instances immediately
            for (const sd of recovered) {
                const inst = restoreDrawing(sd);
                if (!inst) continue;
                seriesApi.attachPrimitive(inst);
                drawingsRef.current.set(inst.id, inst);
            }

            // 3) mark init complete for this chart id
            isInitializedRef.current = currentId;
        })().catch(console.error);

        return () => { active = false; };

    }, [state.chart.id, seriesApi, action]);

    // persist when collection changes, only after initialization for this id
    useEffect(() => {
        const currentId = state.chart.id;
        if (!currentId) return;
        if (isInitializedRef.current !== currentId) return;
        setDrawings(currentId, state.chart.drawings.collection);
    }, [state.chart.id, state.chart.drawings.collection]);

    // detach and clear on chart id change/unmount
    useEffect(() => {
        return () => {
            drawingsRef.current.clear();
            isInitializedRef.current = null;
        };
    }, [state.chart.id, seriesApi]);


    const mouseClickHandler = useCallback((param: MouseEventParams) => {
        try {
            if (!param.point || !param.logical) return;
            const { tools, drawings } = state.chart;
            if (tools.activeHandler) {
                const inst = tools.activeHandler.onClick(param.point.x, param.point.y);
                if (inst) {
                    if (seriesApi) {
                        seriesApi.attachPrimitive(inst);
                    }
                    drawingsRef.current.set(inst.id, inst);
                    action.addDrawing(inst); // reducer should serialize internally
                }
                return;
            }
            const hoveredId = param.hoveredObjectId as string;
            const hit = drawingsRef.current.get(hoveredId);
            if (hit) {
                if (drawings.selected && hit.id !== drawings.selected.id) {
                    drawingsRef.current.get(drawings.selected.id)?.setSelected(false);
                }
                hit.setSelected(true);
                action.selectDrawing(hit);
            } else if (drawings.selected) {
                drawingsRef.current.get(drawings.selected.id)?.setSelected(false);
                action.selectDrawing(null);
            }
        } catch (e) { console.error(e); }
    }, [state.chart.tools.activeHandler, state.chart.drawings, action, seriesApi]);

    const mouseMoveHandler = useCallback((param: MouseEventParams) => {
        try {
            if (!param.point || !param.logical) return;
            const hoveredId = param.hoveredObjectId as string;
            const inst = drawingsRef.current.get(hoveredId);
            setCursor(inst ? 'pointer' : 'default');
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        chartApi?.subscribeClick(mouseClickHandler);
        chartApi?.subscribeCrosshairMove(mouseMoveHandler);
        return () => {
            try {
                chartApi?.unsubscribeClick(mouseClickHandler);
                chartApi?.unsubscribeCrosshairMove(mouseMoveHandler);
            } catch (error) {
                console.error('Error during event cleanup (likely disposed chart):', error);
            }
        };
    }, [chartApi, mouseClickHandler, mouseMoveHandler]);
}
