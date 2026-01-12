import { SerializedDrawing } from "@/core/chart/drawings/types";
import { CollabAction, Product } from "./types";
import { ConnectionState, ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { CrosshairMode, IChartApi, ISeriesApi, SeriesType } from "cochart-charts";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { useCollabStore } from "./useCollabStore";
import { restoreDrawing } from "@/components/chart/hooks/useChartDrawings";
import { enableMapSet, setAutoFreeze } from "immer";
import { DrawingType } from "@/core/chart/types";
import { BaseDrawingHandler } from "@/core/chart/drawings/DrawingHandlerFactory";

interface DataState {
	product: Product
	style: string;
	timeframe: IntervalKey;
	connectionState: ConnectionState;
}

interface ToolState {
	activeTool: DrawingType | null,
	activeHandler: BaseDrawingHandler | null,
}

export interface ChartSettings {
	isOpen: boolean
	cursor: CrosshairMode;
	timezone: string;
	background: {
		theme: "dark" | "light";
		grid: {
			vertLines: {
				visible: boolean;
			};
			horzLines: {
				visible: boolean;
			};
		};
	};
	candles: {
		upColor: string;
		downColor: string;
		borderVisible: boolean;
		wickupColor: string;
		wickDownColor: string;
	};
}

const defaultSettings: ChartSettings = {
	isOpen: false,
	cursor: CrosshairMode.Normal,
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	background: {
		theme: "dark",
		grid: {
			vertLines: {
				visible: true
			},
			horzLines: {
				visible: true
			}
		},
	},
	candles: {
		upColor: '#26a69a',
		downColor: '#ef5350',
		borderVisible: false,
		wickupColor: '#26a69a',
		wickDownColor: '#ef5350'
	},
}


interface ChartState {
	id: string;
	drawings: {
		collection: Map<string, BaseDrawing>;
		selected: string | null;
		updatedAt: number;
	};
	data: DataState;
	chartApi: IChartApi | null;
	seriesApi: ISeriesApi<SeriesType> | null;
	tools: ToolState;
	chartSettings: ChartSettings;
	setChartSettings: (settings: Partial<ChartSettings>) => void;
	toggleChartSettings: (isOpen: boolean) => void;
	setTimezone: (timezone: string) => void;
	setProduct: (product: Product) => void;
	selectChart: (product: Product, timeframe: IntervalKey) => void;
	setInstances: (chartApi: IChartApi | null, seriesApi: ISeriesApi<SeriesType> | null) => void;
	setDataConnectionState: (state: ConnectionState) => void;
	addDrawing: (drawing: BaseDrawing) => void;
	deleteDrawing: (drawingId: string) => void;
	selectDrawing: (drawingId: string | null) => void;
	modifyDrawing: (newDrawing: BaseDrawing) => void;
	startTool: (tool: DrawingType, handler: BaseDrawingHandler) => void;
	cancelTool: () => void;
	syncChart: (product: Product, timeframe: IntervalKey) => void;
	syncAddDrawing: (drawings: SerializedDrawing) => void;
	syncDeleteDrawing: (drawingId: string) => void;
	syncModifyDrawing: (drawing: SerializedDrawing) => void;
}

const defaultData: DataState = {
	product: {
		symbol: "SOL-USD",
		name: "SOLUSD",
		exchange: "coinbase",
	},
	style: 'candle',
	timeframe: "1m",
	connectionState: { status: ConnectionStatus.DISCONNECTED, reconnectAttempts: 0 },
}

enableMapSet();
setAutoFreeze(false);

export const useChartStore = create<ChartState>()(
	persist(
		immer((set) => ({
			id: `${defaultData.product.symbol}:${defaultData.product.exchange}`,
			data: defaultData,
			drawings: {
				collection: new Map(),
				selected: null,
				updatedAt: Date.now()
			},
			chartApi: null,
			seriesApi: null,
			tools: {
				activeTool: null,
				activeHandler: null
			},
			chartSettings: {
				...defaultSettings,
				isOpen: false
			},
			setChartSettings: (settings: Partial<ChartSettings>) => {
				set((state) => ({
					chartSettings: {
						...state.chartSettings,
						...settings
					}
				}))
			},
			toggleChartSettings: (isOpen: boolean) => {
				set((state) => ({
					chartSettings: {
						...state.chartSettings,
						isOpen: isOpen
					}
				}))
			},
			setTimezone: (timezone: string) => set((state) => ({
				chartSettings: {
					...state.chartSettings,
					timezone
				}
			})),
			setProduct: (product: Product) => set((state) => {
				state.data.product = product;
			}),
			selectChart: (product: Product, timeframe: IntervalKey) => {
				set((state) => {
					state.id = `${product.symbol}:${product.exchange}`;
					state.data.product = product;
					state.data.timeframe = timeframe;
				});

				// Side effects go outside the set function
				const { socket, status } = useCollabStore.getState();
				if (status === ConnectionStatus.CONNECTED && socket) {
					socket.send(JSON.stringify({
						type: CollabAction.SELECT_CHART,
						payload: { product, timeframe }
					}));
				}
			},
			syncChart: (product: Product, timeframe: IntervalKey) => {
				set((state) => {
					state.id = `${product.symbol}:${product.exchange}`;
					state.data.product = product;
					state.data.timeframe = timeframe;
				});
			},
			syncAddDrawing: (drawing: SerializedDrawing) => {
				set((state) => {
					const baseDrawing = restoreDrawing(drawing);
					if (!baseDrawing) return;
					state.drawings.collection.set(drawing.id, baseDrawing);
					state.drawings.updatedAt = Date.now();
				});
			},
			syncDeleteDrawing: (drawingId: string) => {
				set((state) => {
					const drawing = state.drawings.collection.get(drawingId);
					if (drawing) { drawing.delete(); }
					state.drawings.collection.delete(drawingId);
					state.drawings.updatedAt = Date.now();
					if (state.drawings.selected === drawingId) {
						state.drawings.selected = null;
					}
				});
			},
			syncModifyDrawing: (drawing: SerializedDrawing) => {
				set((state) => {
					const baseDrawing = restoreDrawing(drawing);
					if (!baseDrawing) return;
					if (state.drawings.collection.has(drawing.id)) {
						state.deleteDrawing(drawing.id);
					}
					state.drawings.collection.set(drawing.id, baseDrawing);
					state.drawings.updatedAt = Date.now();
				})
			},
			setInstances: (chartApi, seriesApi) => set((state) => {
				state.chartApi = chartApi;
				state.seriesApi = seriesApi;
			}),
			setDataConnectionState: (connectionState) => set((state) => {
				state.data.connectionState = connectionState;
			}),
			addDrawing: (drawing: BaseDrawing) => {
				set((state) => {
					state.drawings.collection.set(drawing.id, drawing);
					state.drawings.updatedAt = Date.now();
				});

				const { socket, status } = useCollabStore.getState();
				if (status === ConnectionStatus.CONNECTED && socket) {
					socket.send(JSON.stringify({
						type: CollabAction.ADD_DRAWING,
						payload: { drawing: drawing.serialize() }
					}));
				}
			},
			modifyDrawing: (newDrawing: BaseDrawing) => set((state) => {
				state.drawings.collection.set(newDrawing.id, newDrawing);
				state.drawings.updatedAt = Date.now();

				/*
	
				const { socket, status } = useCollabStore.getState();
				if (status === ConnectionStatus.CONNECTED && socket) {
					socket.send(JSON.stringify({
						type: CollabAction.MODIFY_DRAWING,
						payload: { drawing: newDrawing.serialize() }
					}));
				}
				 * */
			}),
			selectDrawing: (drawingId: string | null) => set((state) => {
				state.drawings.selected = drawingId;
			}),
			deleteDrawing: (drawingId: string) => set((state) => {
				const drawing = state.drawings.collection.get(drawingId);
				if (drawing) { drawing.delete(); }
				state.drawings.collection.delete(drawingId);
				state.drawings.selected = null;
				state.drawings.updatedAt = Date.now();

				const { socket, status } = useCollabStore.getState();
				if (status === ConnectionStatus.CONNECTED && socket) {
					socket.send(JSON.stringify({
						type: CollabAction.DELETE_DRAWING,
						payload: { drawingId: drawingId }
					}));
				}
			}),
			startTool: (tool, handler) => set((state) => {
				state.tools.activeTool = tool;
				state.tools.activeHandler = handler;
			}),
			cancelTool: () => set((state) => {
				state.tools.activeTool = null;
				state.tools.activeHandler = null;
			}),
		})),
		{
			name: 'cochart-settings',
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ chartSettings: state.chartSettings }),
			skipHydration: true,
		}
	)
);
