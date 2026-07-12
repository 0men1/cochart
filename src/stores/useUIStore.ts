import { create } from "zustand";


interface UIState {
	tickerSearchBox: {
		isOpen: boolean;
		searchTerm: string
	};
	welcomeTour: {
		isOpen: boolean;
	};
	toggleTickerSearch: (isOpen: boolean, term?: string) => void;
	toggleWelcomeTour: (isOpen: boolean) => void;
}


export const useUIStore = create<UIState>((set) => ({
	tickerSearchBox: {
		isOpen: false,
		searchTerm: ""
	},
	welcomeTour: { isOpen: false },
	toggleWelcomeTour: (isOpen: boolean) => set(({ welcomeTour: { isOpen } })),
	toggleTickerSearch: (isOpen: boolean, term?: string) => set((state) => ({
		tickerSearchBox: {
			...state.tickerSearchBox,
			isOpen: isOpen,
			searchTerm: term ? term : ""
		}
	})),
}))
