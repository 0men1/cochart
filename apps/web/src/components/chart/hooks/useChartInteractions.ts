'use client'

import { useCallback, useEffect } from "react";
import { useApp } from "../context";

export function useChartInteraction() {
	const { action } = useApp();

	const keyDownHandler = useCallback((event: KeyboardEvent) => {
		if (/^[a-zA-Z]$/.test(event.key)) {
			action.toggleTickerSearchBoxAndSetTerm("");
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
