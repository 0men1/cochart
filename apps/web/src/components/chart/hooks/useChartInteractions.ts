"use client"
import { useCallback, useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";

export function useChartInteraction() {
	const { toggleTickerSearch } = useUIStore();

	const keyDownHandler = useCallback((event: KeyboardEvent) => {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		if (/^[a-zA-Z]$/.test(event.key)) {
			toggleTickerSearch(true, event.key);
		}

		switch (event.key) {
			case 'Escape':
				break;
			default:
				break;
		}
	}, [])

	useEffect(() => {
		window.addEventListener('keydown', keyDownHandler)
		return () => {
			window.removeEventListener('keydown', keyDownHandler)
		}
	}, [keyDownHandler])
}
