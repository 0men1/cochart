import { BaseDrawingHandler, DrawingTool, SerializedDrawing } from "@/core/chart/drawings/types";
import { Product } from "./types";
import { ConnectionState, ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { create } from "zustand";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";


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
	drawings: SerializedDrawing[];
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
	startTool: (tool: DrawingTool, handler: BaseDrawingHandler) => void;
	cancelTool: () => void;
	initializeDrawings: (drawings: SerializedDrawing[]) => void;

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

export const useChartStore = create<ChartState>((set) => ({
	id: `${defaultData.product.symbol}:${defaultData.product.exchange}`,
	data: defaultData,
	drawings: [],
	chartApi: null,
	seriesApi: null,
	tools: {
		activeTool: null,
		activeHandler: null
	},
	setProduct: (product: Product) => set((state) => ({
		...state,
		data: {
			...state.data,
			product
		}
	})),
	selectChart: (product: Product, timeframe: IntervalKey) => set((state) => ({
		...state,
		id: `${product.symbol}:${product.exchange}`,
		data: {
			...state.data,
			product,
			timeframe
		}
	})),
	setInstances: (chartApi: IChartApi | null, seriesApi: ISeriesApi<SeriesType> | null) => set({ chartApi, seriesApi }),
	setDataConnectionState: (connectionState: ConnectionState) => set((state) => ({
		...state,
		data: {
			...state.data,
			connectionState
		}
	})),
	addDrawing: (drawing: BaseDrawing) => set((state) => ({
		drawings: [...state.drawings, drawing.serialize()]
	})),
	deleteDrawing: (drawing: BaseDrawing) => set((state) => ({
		drawings: state.drawings.filter(d => d.id !== drawing.id)
	})),
	startTool: (tool: DrawingTool, handler: BaseDrawingHandler) => set((state) => ({
		...state,
		tools: {
			activeTool: tool,
			activeHandler: handler
		}
	})),
	cancelTool: () => set((state) => ({
		...state,
		tools: {
			activeTool: null,
			activeHandler: null
		}
	})),
	initializeDrawings: (drawings: SerializedDrawing[]) => set(({
		drawings
	}))
}))
