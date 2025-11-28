'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { DrawingTool, BaseDrawingHandler, SerializedDrawing } from "@/core/chart/drawings/types";
import { ConnectionState, ConnectionStatus, ExchangeType, IntervalKey } from "@/core/chart/market-data/types";
import { CrosshairMode, IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { saveAppState } from "@/lib/localStorage";
import { Action, deepMerge, Reducer } from "@/components/chart/reducer";
import { CollabSocket } from "@/core/chart/collaboration/collabSocket";


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

        // ======== Drawing Operations ========
        initializeDrawings: (drawings: SerializedDrawing[]) => void;
        addDrawing: (drawing: BaseDrawing) => void;
        deleteDrawing: (drawing: BaseDrawing) => void;
        selectDrawing: (drawing: BaseDrawing | null) => void;
        startTool: (tool: DrawingTool, handler: BaseDrawingHandler) => void;
        cancelTool: () => void;

        // ======== Collab Operations ========
        createCollabRoom: (roomId: string) => void;
        joinCollabRoom: (roomId: string) => void;
        exitCollabRoom: () => void;
        sendFullState: () => void;
        handleIncomingAction: (incomingAction: Action) => void;
        toggleCollabWindow: (state: boolean) => void;
        setCollabConnectionStatus: (status: ConnectionStatus) => void;

        // ======== Chart Operations ========
        selectChart: (symbol: string, timeframe: IntervalKey, exchange: string) => void;
        setChartConnectionState: (state: ConnectionState) => void;

        // ======== Settings Operations ========
        toggleSettings: (state: boolean) => void;
        updateSettings: (settings: ChartSettings) => void;

        cleanupState: () => void;
    };
    chartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.RefObject<ISeriesApi<SeriesType> | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
    children: React.ReactNode;
    initialState?: Partial<AppState>;
}> = ({ children, initialState }) => {
    const mergedInitial = deepMerge(defaultAppState, initialState || {}) as AppState;
    const [state, dispatch] = useReducer(Reducer, mergedInitial);

    // Keep a ref that always has current state
    const stateRef = useRef(state);
    const collabSocketRef = useRef<CollabSocket | null>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);


    // Update ref whenever state changes
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Initialize socket once
    useEffect(() => {
        collabSocketRef.current = new CollabSocket();
        return () => {
            collabSocketRef.current?.disconnect();
        };
    }, []);

    // All action functions using useCallback with proper dependencies
    const sendFullState = useCallback(() => {
        const currentState = stateRef.current;

        const act: Action = {
            type: "SYNC_FULL_STATE",
            payload: {
                state: {
                    ...currentState,
                    chart: {
                        ...currentState.chart,
                    }
                }
            }
        };

        console.log("Sending full state with symbol:", currentState.chart.data.symbol);
        collabSocketRef.current?.send(JSON.stringify(act));
    }, []);

    const handleIncomingAction = useCallback((incomingAction: Action) => {
        if (!incomingAction || !incomingAction.type) {
            console.error("Invalid action received:", incomingAction);
            return;
        }

        console.log("Handling incoming action:", incomingAction.type);
        dispatch(incomingAction);

        // Check if we should send full state
        if (incomingAction.type === "USER_JOINED") {
            const currentState = stateRef.current; // Read from ref!
            console.log("User joined, isHost:", currentState.collaboration.room.isHost);

            if (currentState.collaboration.room.isHost) {
                console.log("Sending full state as host");
                setTimeout(() => sendFullState(), 100);
            }
        }
    }, [sendFullState]);

    // Drawing actions
    const addDrawing = useCallback((drawing: BaseDrawing) => {
        const act: Action = {
            type: "ADD_DRAWING",
            payload: { drawing: drawing.serialize() }
        };
        dispatch(act);
        collabSocketRef.current?.send(JSON.stringify(act));
    }, []);

    const deleteDrawing = useCallback((drawing: BaseDrawing) => {
        const act: Action = {
            type: "DELETE_DRAWING",
            payload: { drawing: drawing.serialize() }
        };
        dispatch(act);
        collabSocketRef.current?.send(JSON.stringify(act));
    }, []);

    const selectDrawing = useCallback((drawing: BaseDrawing | null) => {
        dispatch({ type: "SELECT_DRAWING", payload: { drawing } });
    }, []);

    const startTool = useCallback((tool: DrawingTool, handler: BaseDrawingHandler) => {
        dispatch({ type: "START_TOOL", payload: { tool, handler } });
    }, []);

    const cancelTool = useCallback(() => {
        dispatch({ type: "CANCEL_TOOL", payload: null });
    }, []);

    // Collab actions
    const createCollabRoom = useCallback((roomId: string) => {
        dispatch({ type: "CREATE_COLLAB_ROOM", payload: { roomId } });
    }, []);

    const toggleCollabWindow = useCallback((state: boolean) => {
        dispatch({ type: "TOGGLE_COLLAB_WINDOW", payload: { state } });
    }, []);

    const joinCollabRoom = useCallback((roomId: string) => {
        dispatch({ type: "JOIN_COLLAB_ROOM", payload: { roomId } });
    }, []);

    const exitCollabRoom = useCallback(() => {
        dispatch({ type: "LEAVE_COLLAB_ROOM", payload: null });
        collabSocketRef.current?.disconnect();
    }, []);

    const setCollabConnectionStatus = useCallback((status: ConnectionStatus) => {
        dispatch({ type: "SET_CONNECTION_STATUS_COLLAB", payload: { status } });
    }, []);

    // Chart actions
    const selectChart = useCallback((symbol: string, timeframe: IntervalKey, exchange: string) => {
        const act: Action = {
            type: "SELECT_CHART",
            payload: { symbol, timeframe, exchange }
        };
        console.log("Selecting chart:", symbol, timeframe, exchange);
        dispatch(act);
        collabSocketRef.current?.send(JSON.stringify(act));
    }, []);

    const setChartConnectionState = useCallback((state: ConnectionState) => {
        dispatch({ type: "SET_CONNECTION_STATE_CHART", payload: { state } });
    }, []);

    const initializeDrawings = useCallback((drawings: SerializedDrawing[]) => {
        dispatch({ type: "INTIALIZE_DRAWINGS", payload: { drawings } });
    }, []);

    const toggleSettings = useCallback((state: boolean) => {
        dispatch({ type: "TOGGLE_SETTINGS", payload: { state } });
    }, []);

    const updateSettings = useCallback((settings: ChartSettings) => {
        dispatch({ type: "UPDATE_SETTINGS", payload: { settings } });
    }, []);

    const cleanupState = useCallback(() => {
        dispatch({ type: "CLEANUP_STATE", payload: null });
    }, []);

    // Connection effect
    useEffect(() => {
        const { id } = state.collaboration.room;

        if (id && collabSocketRef.current) {
            dispatch({
                type: "SET_CONNECTION_STATUS_COLLAB",
                payload: { status: ConnectionStatus.CONNECTING }
            });

            collabSocketRef.current.connect(id, {
                onOpen: () => {
                    console.log(`Connected to room ${id}`);
                    dispatch({
                        type: "SET_CONNECTION_STATUS_COLLAB",
                        payload: { status: ConnectionStatus.CONNECTED }
                    });
                    dispatch({ type: "END_LOADING", payload: null });

                    // If joining as guest, the server will broadcast USER_JOINED
                    // which the host will receive and respond to
                },

                onMessage: (data) => {
                    try {
                        const incomingAction = typeof data === 'string'
                            ? JSON.parse(data)
                            : data;

                        console.log(`Received: ${incomingAction?.type || 'INVALID'}`);
                        handleIncomingAction(incomingAction);
                    } catch (error) {
                        console.error("Error parsing message:", error, data);
                    }
                },

                onClose: () => {
                    console.log("Connection closed");
                    dispatch({
                        type: "SET_CONNECTION_STATUS_COLLAB",
                        payload: { status: ConnectionStatus.DISCONNECTED }
                    });
                    dispatch({ type: "END_LOADING", payload: null });
                },

                onError: (error) => {
                    console.error("Connection error:", error);
                    dispatch({
                        type: "SET_CONNECTION_STATUS_COLLAB",
                        payload: { status: ConnectionStatus.ERROR }
                    });
                    dispatch({ type: "END_LOADING", payload: null });
                }
            });
        }

        return () => {
            if (id && collabSocketRef.current) {
                collabSocketRef.current.disconnect();
            }
        };
    }, [state.collaboration.room.id, handleIncomingAction]);

    useEffect(() => {
        if (state.chart.tools.activeTool || state.chart.tools.activeHandler || state.chart.drawings.selected) {
            return;
        }
        saveAppState(state);
    }, [state]);

    const action = useMemo(() => ({
        addDrawing,
        deleteDrawing,
        selectDrawing,
        startTool,
        cancelTool,
        createCollabRoom,
        joinCollabRoom,
        exitCollabRoom,
        sendFullState,
        handleIncomingAction,
        toggleCollabWindow,
        setCollabConnectionStatus,
        selectChart,
        setChartConnectionState,
        initializeDrawings,
        toggleSettings,
        updateSettings,
        cleanupState,
    }), [
        addDrawing,
        deleteDrawing,
        selectDrawing,
        startTool,
        cancelTool,
        createCollabRoom,
        joinCollabRoom,
        exitCollabRoom,
        sendFullState,
        handleIncomingAction,
        toggleCollabWindow,
        setCollabConnectionStatus,
        selectChart,
        setChartConnectionState,
        initializeDrawings,
        toggleSettings,
        updateSettings,
        cleanupState,
    ]);

    return (
        <AppContext.Provider value={{ state, action, chartRef, seriesRef }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);

    if (!context) {
        throw new Error("useApp must be used within AppProvider");
    }

    return context;
};

