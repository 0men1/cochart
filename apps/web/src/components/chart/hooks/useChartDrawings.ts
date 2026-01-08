import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { TrendLine } from "@/core/chart/drawings/primitives/TrendLine";
import { VertLine } from "@/core/chart/drawings/primitives/VertLine";
import { DrawingOperation, SerializedDrawing } from "@/core/chart/drawings/types";
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
	const { id, drawings, tools, chartApi, seriesApi } = useChartStore();
	const { addDrawing, modifyDrawing, deleteDrawing, selectDrawing, cancelTool } = useChartStore();

	const isInitializedRef = useRef<string | null>(null);

	const attachListeners = useCallback((drawing: BaseDrawing) => {
		drawing.subscribe(DrawingOperation.DELETE, () => {
			deleteDrawing(drawing.id);
			drawing.options
		})
		drawing.subscribe(DrawingOperation.SELECT, () => {
			selectDrawing(drawing.id);
		})
		drawing.subscribe(DrawingOperation.MODIFY, () => {
			modifyDrawing(drawing);
		})
	}, [addDrawing, modifyDrawing, selectDrawing, drawings.selected])

	useEffect(() => {
		if (!seriesApi) return;
		let active = true;

		(async () => {
			if (!seriesApi || isInitializedRef.current === id || !active) return;
			const recovered = await getDrawings(id)

			// 2) restore + attach concrete instances immediately
			for (const sd of recovered) {
				const inst = restoreDrawing(sd);
				if (!inst) continue;
				seriesApi.attachPrimitive(inst);
				attachListeners(inst);
				addDrawing(inst);
			}

			// 3) mark init complete for this chart id
			isInitializedRef.current = id;
		})().catch(console.error);

		return () => { active = false; };
	}, [id, seriesApi]);

	useEffect(() => {
		if (!seriesApi) return;



	}, [drawings.collection])

	// persist when collection changes, only after initialization for this id
	useEffect(() => {
		if (!id) return;
		if (isInitializedRef.current !== id) return;
		setDrawings(id, drawings.collection.values().toArray());
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
				if (inst && seriesApi) {
					seriesApi.attachPrimitive(inst);
					attachListeners(inst);
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
			setCursor(hoveredId ? 'pointer' : 'default');
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
