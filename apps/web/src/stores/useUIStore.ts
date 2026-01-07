import { CrosshairMode } from "lightweight-charts";
import { create } from "zustand";

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

interface UIState {
	settings: ChartSettings;
	tickerSearchBox: {
		isOpen: boolean;
		searchTerm: string
	};
	featureSpotlight: {
		isOpen: boolean;
	};
	toggleSettings: (isOpen: boolean) => void;
	updateSettings: (settings: Partial<ChartSettings>) => void;
	toggleTickerSearch: (isOpen: boolean, term?: string) => void;
	toggleFeatureSpotlight: (isOpen: boolean) => void;
	setTimezone: (timezone: string) => void;
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

export const useUIStore = create<UIState>((set) => ({
	settings: defaultSettings,
	tickerSearchBox: {
		isOpen: false,
		searchTerm: ""
	},
	featureSpotlight: { isOpen: false },
	toggleFeatureSpotlight: (isOpen: boolean) => set(({ featureSpotlight: { isOpen } })),
	toggleSettings: (isOpen: boolean) => set((state) => ({
		settings: {
			...state.settings,
			isOpen: isOpen
		}
	})),
	updateSettings: (newSettings: Partial<ChartSettings>) => set((state) => ({
		settings: {
			...state.settings,
			...newSettings
		}
	})),
	toggleTickerSearch: (isOpen: boolean, term?: string) => set((state) => ({
		tickerSearchBox: {
			...state.tickerSearchBox,
			isOpen: isOpen,
			searchTerm: term ? term : ""
		}
	})),
	setTimezone: (timezone: string) => set((state) => ({
		settings: {
			...state.settings,
			timezone
		}
	})),
}))
