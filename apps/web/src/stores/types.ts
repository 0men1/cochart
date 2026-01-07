import { CrosshairMode } from "lightweight-charts";

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

export interface Product {
	symbol: string;
	name: string;
	exchange: string;
}

export enum CollabAction {
	SELECT_CHART = 'SELECT_CHART',
	ADD_DRAWING = 'ADD_DRAWING',
	DELETE_DRAWING = 'DELETE_DRAWING',
}
