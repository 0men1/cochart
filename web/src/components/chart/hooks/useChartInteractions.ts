"use client"
import { useCallback, useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useCollabStore } from "@/stores/useCollabStore";

export function useChartInteraction() {
	const { toggleTickerSearch } = useUIStore();

	const keyDownHandler = useCallback((event: KeyboardEvent) => {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		// Only open the ticker search on a bare character keystroke. Ignore
		// keyboard shortcuts (Cmd/Ctrl/Alt combos like Cmd+T) so we don't hijack
		// the browser; Shift is fine since it just yields an uppercase letter.
		if (event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}

		// Don't steal typing while a blocking prompt owns the screen.
		if (useCollabStore.getState().pendingSnapshot) {
			return;
		}

		if (/^[a-zA-Z]$/.test(event.key)) {
			toggleTickerSearch(true, event.key);
		}
	}, [toggleTickerSearch])

	useEffect(() => {
		window.addEventListener('keydown', keyDownHandler)
		return () => {
			window.removeEventListener('keydown', keyDownHandler)
		}
	}, [keyDownHandler])
}
