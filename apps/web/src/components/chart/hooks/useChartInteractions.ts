'use client'

import { useCallback, useEffect } from "react";
import { useApp } from "../context"

export function useChartInteraction(
    containerRef: React.RefObject<HTMLDivElement | null>,
) {

    const { state, action, chartRef, seriesRef } = useApp();

    const keyPressHandler = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case '':
                break;
            default:
                break;
        }
    }, [])

    useEffect(() => {
        containerRef.current?.addEventListener('keypress', keyPressHandler)
    }, [])
}
