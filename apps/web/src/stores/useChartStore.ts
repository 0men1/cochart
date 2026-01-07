import { BaseDrawingHandler, DrawingTool, SerializedDrawing } from "@/core/chart/drawings/types";
import { CollabAction, Product } from "./types";
import { ConnectionState, ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { useCollabStore } from "./useCollabStore";


interface DataState {
	product: Product
	style: string;
	timeframe: IntervalKey;
	connectionState: ConnectionState;
}

interface ToolState {
	activeTool: DrawingTool | null,
	activeHandler: BaseDrawingHandler | null,
}

interface ChartState {
	id: string;
	drawings: {
		collection: SerializedDrawing[];
		selected: BaseDrawing | null;
	};
	data: DataState;
	chartApi: IChartApi | null;
	seriesApi: ISeriesApi<SeriesType> | null;
	tools: ToolState;
	setProduct: (product: Product) => void;
	selectChart: (product: Product, timeframe: IntervalKey) => void;
	setInstances: (chartApi: IChartApi | null, seriesApi: ISeriesApi<SeriesType> | null) => void;
	setDataConnectionState: (state: ConnectionState) => void;
	addDrawing: (drawing: BaseDrawing) => void;
	deleteDrawing: (drawing: BaseDrawing) => void;
	selectDrawing: (drawing: BaseDrawing | null) => void;
	startTool: (tool: DrawingTool, handler: BaseDrawingHandler) => void;
	cancelTool: () => void;
	initializeDrawings: (drawings: SerializedDrawing[]) => void;
	syncChart: (product: Product, timeframe: IntervalKey) => void;
	syncAddDrawing: (drawings: SerializedDrawing) => void;
	syncDeleteDrawing: (drawingId: string) => void;
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

export const useChartStore = create<ChartState>()(
	immer((set) => ({
		id: `${defaultData.product.symbol}:${defaultData.product.exchange}`,
		data: defaultData,
		drawings: {
			collection: [],
			selected: null
		},
		chartApi: null,
		seriesApi: null,
		tools: {
			activeTool: null,
			activeHandler: null
		},
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
			console.log("Syncing chart from remote...");
			set((state) => {
				state.id = `${product.symbol}:${product.exchange}`;
				state.data.product = product;
				state.data.timeframe = timeframe;
			});
		},
		syncAddDrawing: (drawing: SerializedDrawing) => {
			set((state) => {
				const exists = state.drawings.collection.some((d: SerializedDrawing) => d.id === drawing.id);
				if (!exists) {
					state.drawings.collection.push(drawing);
				}
			});
		},
		syncDeleteDrawing: (drawingId: string) => {
			set((state) => {
				state.drawings.collection = state.drawings.collection.filter(
					(d: SerializedDrawing) => d.id !== drawingId
				);

				// Deselect if it was selected
				if (state.drawings.selected?.id === drawingId) {
					state.drawings.selected = null;
				}
			});
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
				state.drawings.collection.push(drawing.serialize());
			});

			const { socket, status } = useCollabStore.getState();
			if (status === ConnectionStatus.CONNECTED && socket) {
				socket.send(JSON.stringify({
					type: CollabAction.ADD_DRAWING,
					payload: { drawing: drawing.serialize() }
				}));
			}
		},
		selectDrawing: (drawing) => set((state) => {
			state.drawings.selected = drawing;
		}),
		deleteDrawing: (drawing) => set((state) => {
			state.drawings.selected = null;
			state.drawings.collection = state.drawings.collection.filter((d: SerializedDrawing) => d.id !== drawing.id);

			const { socket, status } = useCollabStore.getState();
			if (status === ConnectionStatus.CONNECTED && socket) {
				socket.send(JSON.stringify({
					type: CollabAction.DELETE_DRAWING,
					payload: { drawingId: drawing.id }
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
		initializeDrawings: (drawings) => set((state) => {
			state.drawings.collection = drawings;
		})
	}))
);
