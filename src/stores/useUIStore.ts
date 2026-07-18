import { create } from "zustand";


interface UIState {
  tickerSearchBox: {
    isOpen: boolean;
    searchTerm: string
  };
  featureSpotlight: {
    isOpen: boolean;
  };
  drawingSettings: {
    isOpen: boolean;
    drawingId: string | null;
  };
  drawingManager: {
    isOpen: boolean;
  };
  indicatorDialog: {
    isOpen: boolean;
  };
  indicatorManager: {
    isOpen: boolean;
  };
  indicatorSettings: {
    isOpen: boolean;
    indicatorId: string | null;
  };
  suggestionBox: {
    isOpen: boolean;
  };
  toggleTickerSearch: (isOpen: boolean, term?: string) => void;
  toggleFeatureSpotlight: (isOpen: boolean) => void;
  toggleWelcomeTour: (isOpen: boolean) => void;
  openDrawingSettings: (drawingId: string) => void;
  closeDrawingSettings: () => void;
  toggleDrawingManager: (isOpen: boolean) => void;
  toggleIndicatorDialog: (isOpen: boolean) => void;
  toggleIndicatorManager: (isOpen: boolean) => void;
  openIndicatorSettings: (indicatorId: string) => void;
  closeIndicatorSettings: () => void;
  toggleSuggestion: (isOpen: boolean) => void;
  welcomeTour: {
    isOpen: boolean;
  };
}


export const useUIStore = create<UIState>((set) => ({
  tickerSearchBox: {
    isOpen: false,
    searchTerm: ""
  },
  featureSpotlight: { isOpen: false },
  toggleFeatureSpotlight: (isOpen: boolean) => set(({ featureSpotlight: { isOpen } })),
  drawingSettings: { isOpen: false, drawingId: null },
  openDrawingSettings: (drawingId: string) => set({ drawingSettings: { isOpen: true, drawingId } }),
  closeDrawingSettings: () => set({ drawingSettings: { isOpen: false, drawingId: null } }),
  drawingManager: { isOpen: false },
  toggleDrawingManager: (isOpen: boolean) => set({ drawingManager: { isOpen } }),
  indicatorDialog: { isOpen: false },
  toggleIndicatorDialog: (isOpen: boolean) => set({ indicatorDialog: { isOpen } }),
  indicatorManager: { isOpen: false },
  toggleIndicatorManager: (isOpen: boolean) => set({ indicatorManager: { isOpen } }),
  indicatorSettings: { isOpen: false, indicatorId: null },
  openIndicatorSettings: (indicatorId: string) => set({ indicatorSettings: { isOpen: true, indicatorId } }),
  closeIndicatorSettings: () => set({ indicatorSettings: { isOpen: false, indicatorId: null } }),
  suggestionBox: { isOpen: false },
  toggleSuggestion: (isOpen: boolean) => set({ suggestionBox: { isOpen } }),
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
