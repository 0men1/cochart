'use client'

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { DrawingTool, BaseDrawingHandler, SerializedDrawing } from "@/core/chart/drawings/types";
import { ConnectionState, ConnectionStatus, ExchangeType, IntervalKey } from "@/core/chart/market-data/types";
import { CrosshairMode, IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { saveAppState } from "@/lib/localStorage";
import { Action, deepMerge, Reducer } from "@/components/chart/reducer";


export interface ChartSettings {
    isOpen: boolean
    background: {
        theme: "dark" | "light";
        grid: {
            vertLines: {
                visible: boolean;
            };
            horzLines: {
                visible: boolean;
            };
        };
    };
    candles: {
        upColor: string;
        downColor: string;
        borderVisible: boolean;
        wickupColor: string;
        wickDownColor: string;
    };

}

export interface AppState {
    lastSaved: string,
    collaboration: {
        isOpen: boolean;
        room: {
            id: string | null,
            isHost: boolean,
            isLoading: boolean,
            activeUsers: string[]
            status: ConnectionStatus;
        }
    };
    chart: {
        id: string;
        chartApi: IChartApi | null,
        seriesApi: ISeriesApi<SeriesType> | null,
        container: HTMLDivElement | null,
        tools: {
            activeTool: DrawingTool | null,
            activeHandler: BaseDrawingHandler | null,
        }
        drawings: {
            collection: SerializedDrawing[];
            selected: BaseDrawing | null;
        };
        settings: ChartSettings;
        cursor: CrosshairMode;
        data: {
            style: string;
            symbol: string;
            timeframe: IntervalKey;
            exchange: ExchangeType;
            state: ConnectionState;
        };
    }
}

// export interface CollabAppState {
// }

export const defaultAppState: AppState = {
    lastSaved: "",
    collaboration: {
        isOpen: false,
        room: {
            id: null,
            isLoading: false,
            isHost: false,
            activeUsers: [],
            status: ConnectionStatus.DISCONNECTED
        }
    },
    chart: {
        id: "SOL-USD:coinbase",
        chartApi: null,
        seriesApi: null,
        container: null,
        drawings: {
            collection: [],
            selected: null
        },
        tools: {
            activeTool: null,
            activeHandler: null
        },
        settings: {
            isOpen: false,
            background: {
                theme: "dark",
                grid: {
                    vertLines: {
                        visible: true
                    },
                    horzLines: {
                        visible: true
                    }
                },
            },
            candles: {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickupColor: '#26a69a',
                wickDownColor: '#ef5350'
            },
        },
        data: {
            style: 'candle',
            symbol: "SOL-USD",
            timeframe: "1m",
            exchange: "coinbase",
            state: { status: ConnectionStatus.DISCONNECTED, reconnectAttempts: 0 },
        },
        cursor: CrosshairMode.Normal,
    }
};

interface AppContextType {
    state: AppState;
    action: {
        addDrawing: (drawing: BaseDrawing) => void;
        deleteDrawing: (drawing: BaseDrawing) => void;
        selectDrawing: (drawing: BaseDrawing | null) => void;

        createCollabRoom: (roomId: string) => void;
        joinCollabRoom: (roomId: string) => void;
        exitCollabRoom: () => void;
        userJoined: (displayName: string) => void;
        userLeft: (displayName: string) => void;
        sendFullState: () => void;
        handleIncomingAction: (incomingAction: Action) => void;
        toggleCollabWindow: (state: boolean) => void;
        setCollabConnectionStatus: (status: ConnectionStatus) => void;

        startTool: (tool: DrawingTool, handler: BaseDrawingHandler) => void;
        cancelTool: () => void;

        selectChart: (symbol: string, timeframe: IntervalKey, exchange: string) => void;
        setChartConnectionState: (state: ConnectionState) => void;

        initializeApi: (chartApi: IChartApi, seriesApi: ISeriesApi<SeriesType>, container: HTMLDivElement) => void;
        initializeDrawings: (drawings: SerializedDrawing[]) => void;

        toggleSettings: (state: boolean) => void;
        updateSettings: (settings: ChartSettings) => void;

        cleanupState: () => void;
    };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
    children: React.ReactNode;
    initialState?: Partial<AppState>;
}> = ({
    children,
    initialState,
}) => {
        const mergedInitial = deepMerge(defaultAppState, initialState || {}) as AppState;
        const [state, dispatch] = useReducer(Reducer, mergedInitial);
        const wsRef = useRef<WebSocket | null>(null);

        useEffect(() => {
            if (state.chart.tools.activeTool || state.chart.tools.activeHandler || state.chart.drawings.selected) {
                return;
            }
            saveAppState(state);
        }, [state])

        useEffect(() => {
            const { id } = state.collaboration.room

            if (id && !wsRef.current) {

                // Link to the room to connect
                const roomUrl = `localhost:8080/rooms/join?roomId=${id}`

                wsRef.current = new WebSocket(`ws://${roomUrl}`);

                console.log(`Connecting to room ${id}`)

                wsRef.current.onopen = () => {
                    console.log("Socket connection open")
                    action.joinCollabRoom(id)
                    action.setCollabConnectionStatus(ConnectionStatus.CONNECTED)
                    dispatch({ type: "END_LOADING", payload: null })
                }

                wsRef.current.onmessage = (event: MessageEvent) => {
                    const incomingAction = JSON.parse(event.data)
                    console.log(`Received action: `, incomingAction.type)
                    action.handleIncomingAction(incomingAction);
                }

                wsRef.current.onclose = () => {
                    action.exitCollabRoom()
                    action.setCollabConnectionStatus(ConnectionStatus.DISCONNECTED)
                    console.log("Socket connection closed")
                    dispatch({ type: "END_LOADING", payload: null })
                }

                wsRef.current.onerror = (error: Event) => {
                    action.setCollabConnectionStatus(ConnectionStatus.ERROR)
                    console.log("socket connection error: ", error)
                    dispatch({ type: "END_LOADING", payload: null })
                }
            }

            return () => {
                if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                }
            }
        }, [state.collaboration.room.id])

        const action = useMemo(() => ({

            // ----------------DRAWING FUNCTIONS-------------------
            addDrawing: (drawing: BaseDrawing) => {
                const act: Action = {
                    type: "ADD_DRAWING",
                    payload: {
                        drawing: drawing.serialize()
                    }
                }
                dispatch(act);
                wsRef.current?.send(JSON.stringify(act));


            },

            deleteDrawing: (drawing: BaseDrawing) => {
                const act: Action = {
                    type: "DELETE_DRAWING",
                    payload: {
                        drawing:
                            drawing.serialize()
                    }
                }
                dispatch(act);
                wsRef.current?.send(JSON.stringify(act));
            },

            selectDrawing: (drawing: BaseDrawing | null) => {
                dispatch({ type: "SELECT_DRAWING", payload: { drawing } })
            },

            startTool: (tool: DrawingTool, handler: BaseDrawingHandler) => {
                dispatch({ type: "START_TOOL", payload: { tool, handler } })
            },

            cancelTool: () => {
                dispatch({ type: "CANCEL_TOOL", payload: null })
            },


            // ----------------COLLAB FUNCTIONS-------------------
            createCollabRoom: (roomId: string) => {
                const act: Action = {
                    type: "CREATE_COLLAB_ROOM",
                    payload: {
                        roomId
                    }
                }
                dispatch(act)
            },

            userJoined: (displayName: string) => {
                const act: Action = {
                    type: "USER_JOINED",
                    payload: {
                        displayName
                    }
                }
                action.handleIncomingAction(act);
            },

            userLeft: (displayName: string) => {
                const act: Action = {
                    type: "USER_LEFT",
                    payload: {
                        displayName
                    }
                }
                action.handleIncomingAction(act);
            },

            toggleCollabWindow: (state: boolean) => {
                dispatch({ type: "TOGGLE_COLLAB_WINDOW", payload: { state } })
            },

            joinCollabRoom: (roomId: string) => {
                dispatch({ type: "JOIN_COLLAB_ROOM", payload: { roomId } })
            },

            exitCollabRoom: () => {
                dispatch({ type: "LEAVE_COLLAB_ROOM", payload: null })
                wsRef.current?.close()
            },

            sendFullState: () => {
                const act: Action = {
                    type: "SYNC_FULL_STATE",
                    payload: {
                        state: {
                            ...state,
                            chart: {
                                ...state.chart,
                                chartApi: null,
                                seriesApi: null,
                                container: null
                            }
                        }
                    }
                }
                wsRef.current?.send(JSON.stringify(act))
            },

            handleIncomingAction: (incomingAction: Action) => {
                if (incomingAction.type === "USER_JOINED") {
                    dispatch(incomingAction);
                    action.sendFullState();
                } else if (incomingAction.type === "SYNC_FULL_STATE") {
                    dispatch(incomingAction);
                } else if (incomingAction.type === "USER_LEFT") {
                    dispatch(incomingAction);
                } else {
                    dispatch(incomingAction);
                }
            },

            setCollabConnectionStatus: (status: ConnectionStatus) => {
                const act: Action = {
                    type: "SET_CONNECTION_STATUS_COLLAB",
                    payload: { status }
                }
                dispatch(act);
            },


            // ----------------CHART FUNCTIONS-------------------
            selectChart: (symbol: string, timeframe: IntervalKey, exchange: string) => {
                const act: Action = {
                    type: "SELECT_CHART",
                    payload: {
                        symbol,
                        timeframe,
                        exchange
                    }
                }
                dispatch(act)
                wsRef.current?.send(JSON.stringify(act))
            },

            setChartConnectionState: (state: ConnectionState) => {
                const act: Action = {
                    type: "SET_CONNECTION_STATE_CHART",
                    payload: { state }
                }
                dispatch(act);
            },


            initializeApi: (chartApi: IChartApi, seriesApi: ISeriesApi<SeriesType>, container: HTMLDivElement) => {
                dispatch({ type: "INITIALIZE_API", payload: { chartApi, seriesApi, container } })
            },

            initializeDrawings: (drawings: SerializedDrawing[]) => {
                dispatch({ type: "INTIALIZE_DRAWINGS", payload: { drawings } })
            },

            toggleSettings: (state: boolean) => {
                dispatch({ type: "TOGGLE_SETTINGS", payload: { state } })
            },

            updateSettings: (settings: ChartSettings) => {
                dispatch({ type: "UPDATE_SETTINGS", payload: { settings } })
            },

            cleanupState: () => {
                dispatch({ type: "CLEANUP_STATE", payload: null })
            },


        }), [state])

        return (
            <AppContext.Provider value={{ state, action }}>
                {children}
            </AppContext.Provider>
        );
    };

export const useApp = () => {
    const Context = useContext(AppContext);

    if (!Context) {
        throw new Error("useApp must be used within AppProvider");
    }
    return Context;
}
