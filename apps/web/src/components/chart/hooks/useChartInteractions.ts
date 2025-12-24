'use client'

import { useCallback, useEffect } from "react";
import { useApp } from "../context";

export function useChartInteraction() {
    const { action } = useApp();

    const keyDownHandler = useCallback((event: KeyboardEvent) => {
        if (/^[a-zA-Z]$/.test(event.key)) {
            action.toggleTickerSearchBox(true);
        }

        switch (event.key) {
            case 'Escape':
                action.toggleTickerSearchBox(false);
                action.toggleCollabWindow(false);
                action.cancelTool();
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
