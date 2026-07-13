import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./useUIStore";

describe("useUIStore drawingSettings", () => {
	beforeEach(() => {
		useUIStore.getState().closeDrawingSettings();
	});

	it("defaults to closed with no target", () => {
		expect(useUIStore.getState().drawingSettings).toEqual({ isOpen: false, drawingId: null });
	});

	it("openDrawingSettings opens the page for the given drawing", () => {
		useUIStore.getState().openDrawingSettings("drawing-1");
		expect(useUIStore.getState().drawingSettings).toEqual({ isOpen: true, drawingId: "drawing-1" });
	});

	it("closeDrawingSettings clears the target", () => {
		useUIStore.getState().openDrawingSettings("drawing-1");
		useUIStore.getState().closeDrawingSettings();
		expect(useUIStore.getState().drawingSettings).toEqual({ isOpen: false, drawingId: null });
	});
});
