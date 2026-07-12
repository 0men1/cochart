import { create } from "zustand";


interface UIState {
	tickerSearchBox: {
		isOpen: boolean;
		searchTerm: string
	};
	featureSpotlight: {
		isOpen: boolean;
	};
	toggleTickerSearch: (isOpen: boolean, term?: string) => void;
	toggleFeatureSpotlight: (isOpen: boolean) => void;
}


export const useUIStore = create<UIState>((set) => ({
	tickerSearchBox: {
		isOpen: false,
		searchTerm: ""
	},
	featureSpotlight: { isOpen: false },
	toggleFeatureSpotlight: (isOpen: boolean) => set(({ featureSpotlight: { isOpen } })),
	toggleTickerSearch: (isOpen: boolean, term?: string) => set((state) => ({
		tickerSearchBox: {
			...state.tickerSearchBox,
			isOpen: isOpen,
			searchTerm: term ? term : ""
		}
	})),
}))
