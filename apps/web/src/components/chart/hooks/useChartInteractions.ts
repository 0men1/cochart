"use client"
import { useCallback, useEffect } from "react";
import { useApp } from "../context";

export function useChartInteraction() {
	const { action } = useApp();

	const keyDownHandler = useCallback((event: KeyboardEvent) => {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		if (/^[a-zA-Z]$/.test(event.key)) {
			action.toggleTickerSearchBoxAndSetTerm(event.key);
		}

		switch (event.key) {
			case 'Escape':
				break;
			default:
				break;
		}
	}, [action])

	useEffect(() => {
		window.addEventListener('keydown', keyDownHandler)
		return () => {
			window.removeEventListener('keydown', keyDownHandler)
		}
	}, [keyDownHandler])
}
