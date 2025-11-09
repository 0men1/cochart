'use client'

import ClientChart from "@/components/chart/ClientChart";
import { AppState, defaultAppState } from "@/components/chart/context";
import { LocalStorage } from "@/lib/localStorage";
import { useEffect, useState } from "react";

export function getInitialState(): AppState {
    if (typeof window === 'undefined') {
        return defaultAppState;
    }
    const state = LocalStorage.getItem<AppState>("AppState");
    if (state === null) {
        return defaultAppState
    } else {
        return state;
    }
}

export default function SoloChart() {
    const [initialState, setInitialState] = useState<AppState>(defaultAppState);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        console.log("Starting solo chart")
        setInitialState(getInitialState());
        setIsLoaded(true);
    }, []);

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <ClientChart initialState={initialState} />
    )
}
