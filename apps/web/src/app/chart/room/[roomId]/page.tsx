'use client'

import ClientChart from "@/components/chart/ClientChart";
import { AppState } from "@/components/chart/context";
import { ConnectionStatus } from "@/core/chart/market-data/types";
import { getInitialState } from "@/lib/localStorage";
import { use, useEffect, useState } from "react";

export default function ChartCollabRoom({
    params
}: {
    params: Promise<{ roomId: string }>
}) {
    const { roomId } = use(params);
    const [initialState, setInitialState] = useState<AppState | null>(null);

    useEffect(() => {
        if (!roomId) {
            console.error("Missing roomId");
            return;
        }
        const baseState = getInitialState();
        const collabState: AppState = {
            ...baseState,
            collaboration: {
                ...baseState.collaboration,
                room: {
                    ...baseState.collaboration.room,
                    id: roomId,
                    isHost: false,
                    isLoading: true,
                    status: ConnectionStatus.CONNECTING
                }
            }
        };

        setInitialState(collabState);
    }, [roomId]);

    if (!roomId) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-red-500">Error: Missing room ID</div>
            </div>
        );
    }

    if (!initialState) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div>Joining room...</div>
            </div>
        );
    }

    return <ClientChart initialState={initialState} />;
}

