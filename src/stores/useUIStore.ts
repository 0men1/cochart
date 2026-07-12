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
  toggleTickerSearch: (isOpen: boolean, term?: string) => void;
  toggleFeatureSpotlight: (isOpen: boolean) => void;
  toggleWelcomeTour: (isOpen: boolean) => void;
  openDrawingSettings: (drawingId: string) => void;
  closeDrawingSettings: () => void;
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
