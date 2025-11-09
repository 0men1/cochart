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
    const isInitializedRef = useRef<string>(null);

    useEffect(() => {
        if (isInitializedRef.current && state.chart.id === isInitializedRef.current) {
            return;
        }

        try {
            const initializeDrawings = async () => {
                const recoveredDrawings = await getDrawings(state.chart.id);
                action.initializeDrawings(recoveredDrawings);
                isInitializedRef.current = state.chart.id;
            }
            initializeDrawings();
        } catch (e) {
            console.error(e)
        }

    }, [state.chart.id, seriesApi, action])

    useEffect(() => {
        if (!seriesApi || !isInitializedRef.current || isInitializedRef.current !== state.chart.id) {
            return
        }

        console.log('=== DRAWING SYNC EFFECT ===');
        console.log('Chart ID:', state.chart.id);
        console.log('Drawings in state:', state.chart.drawings.collection.length);

        const currentDrawings = drawingsRef.current;
        const serializedDrawings = state.chart.drawings.collection;
        const stateIds = new Set(serializedDrawings.map(d => d.id));

        // Step 1: Remove drawings that are no longer in state
        for (const [id, drawing] of Array.from(currentDrawings.entries())) {
            if (!stateIds.has(id)) {
                console.log("Detaching removed drawing:", id);
                seriesApi.detachPrimitive(drawing);
                currentDrawings.delete(id);
            }
        }

        // Step 2: Add new drawings that aren't in the ref yet
        for (const drawing of serializedDrawings) {
            if (!currentDrawings.has(drawing.id)) {
                const restoredDrawing = restoreDrawing(drawing);
                if (restoredDrawing) {
                    console.log('Attaching new drawing:', drawing.id);
                    seriesApi.attachPrimitive(restoredDrawing);
                    currentDrawings.set(drawing.id, restoredDrawing);
                }
            }
        }

        return () => {
            currentDrawings.clear()
        }
    }, [state.chart.drawings.collection, seriesApi, state.chart.id])

    useEffect(() => {
        if (!isInitializedRef.current || isInitializedRef.current !== state.chart.id) return;
        setDrawings(state.chart.id, state.chart.drawings.collection);
    }, [state.chart.drawings.collection, state.chart.id])

    const mouseClickHandler = useCallback((param: MouseEventParams) => {
        try {
            if (!param.point || !param.logical) return;

            const { tools, drawings } = state.chart;
            if (tools.activeHandler) {
                const drawing = tools.activeHandler.onClick(param.point.x, param.point.y);
                if (drawing) {
                    action.addDrawing(drawing);
                }
            } else {
                const hoveredDrawingId = param.hoveredObjectId as string;
                const drawing = drawingsRef.current.get(hoveredDrawingId);
                if (drawing) {
                    if (drawings.selected && drawing.id !== drawings.selected.id) {
                        drawingsRef.current.get(drawings.selected.id)?.setSelected(false);
                    }
                    drawing.setSelected(true);
                    action.selectDrawing(drawing);
                } else if (drawings.selected) {
                    drawingsRef.current.get(drawings.selected.id)?.setSelected(false);
                    action.selectDrawing(null);
                }
            }
        } catch (e) {
            console.error(e)
        }
    }, [state.chart.tools.activeHandler, state.chart.drawings, action])

    const mouseMoveHandler = useCallback((param: MouseEventParams) => {
        try {
            if (!param.point || !param.logical) return;

            const hoveredDrawingId = param.hoveredObjectId as string;
            const drawing = drawingsRef.current.get(hoveredDrawingId);
            setCursor(drawing ? 'pointer' : 'default')
        } catch (e) {
            console.error(e)
        }
    }, [])

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
        }
    }, [chartApi, mouseClickHandler, mouseMoveHandler])
}
