import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { TrendLine } from "@/core/chart/drawings/primitives/TrendLine";
import { VertLine } from "@/core/chart/drawings/primitives/VertLine";
import { SerializedDrawing } from "@/core/chart/drawings/types";
import { useCallback, useEffect, useRef } from "react";
import { getDrawings, setDrawings } from "@/lib/indexdb";
import { MouseEventParams } from "cochart-charts";
import { setCursor } from "@/core/chart/cursor";
import { useChartStore } from "@/stores/useChartStore";
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
	const { id, drawings, tools, chartApi, seriesApi, cancelTool } = useChartStore();
	const { addDrawing, initializeDrawings, selectDrawing } = useChartStore();

	const drawingsRef = useRef<Map<string, BaseDrawing>>(new Map());
	const isInitializedRef = useRef<string | null>(null);

	useEffect(() => {
		if (!seriesApi) return;
		let active = true;

		(async () => {
			if (!seriesApi || isInitializedRef.current === id) return;

			const recovered = await getDrawings(id)

			if (!active) return;

			initializeDrawings(recovered);

			// 2) restore + attach concrete instances immediately
			for (const sd of recovered) {
				const inst = restoreDrawing(sd);
				if (!inst) continue;
				seriesApi.attachPrimitive(inst);
				drawingsRef.current.set(inst.id, inst);
			}

			// 3) mark init complete for this chart id
			isInitializedRef.current = id;
		})().catch(console.error);

		return () => { active = false; };
	}, [id, seriesApi]);

	useEffect(() => {
		if (!seriesApi) return;
		if (isInitializedRef.current !== id) return;

		const currentDrawings = drawingsRef.current;
		const collectionDrawings = drawings.collection;

		// Attach drawings that do appear in collection but not in drawingsRef
		collectionDrawings.forEach(drawing => {
			if (!currentDrawings.has(drawing.id)) {
				const restoredDrawing = restoreDrawing(drawing);
				if (restoredDrawing) {
					seriesApi?.attachPrimitive(restoredDrawing);
					currentDrawings.set(restoredDrawing.id, restoredDrawing);
				}
			}
		})

		for (const id of currentDrawings.keys()) {
			if (!collectionDrawings.some(d => d.id === id)) {
				const drawing = currentDrawings.get(id);
				if (drawing) {
					seriesApi.detachPrimitive(drawing);
					currentDrawings.delete(id)
				}
			}
		}
	}, [drawings, id, seriesApi])

	// persist when collection changes, only after initialization for this id
	useEffect(() => {
		if (!id) return;
		if (isInitializedRef.current !== id) return;
		setDrawings(id, drawings.collection);
	}, [id, drawings]);


	//detach and clear on chart id change/unmount
	useEffect(() => {
		return () => {
			isInitializedRef.current = null;
		};
	}, [id, seriesApi]);

	const mouseClickHandler = useCallback((param: MouseEventParams) => {
		try {
			if (!param.point || !param.logical) return;
			if (tools.activeHandler) {
				const inst = tools.activeHandler.onClick(param.point.x, param.point.y);
				if (inst) {
					if (seriesApi) {
						seriesApi.attachPrimitive(inst);
						drawingsRef.current.set(inst.id, inst);
						addDrawing(inst); // reducer should serialize internally
						cancelTool();
					}
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
				selectDrawing(hit);
			} else if (drawings.selected) {
				drawingsRef.current.get(drawings.selected.id)?.setSelected(false);
				selectDrawing(null);
			}
		} catch (e) { console.error(e); }
	}, [tools.activeHandler, drawings, seriesApi]);

	const mouseMoveHandler = useCallback((param: MouseEventParams) => {
		try {
			if (!param.point || !param.logical) return;
			const hoveredId = param.hoveredObjectId as string;
			const inst = drawingsRef.current.get(hoveredId);
			setCursor(inst ? 'pointer' : 'default');
		} catch (e) { console.error(e); }
	}, [tools.activeHandler]);

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
