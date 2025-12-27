import { BaseDrawingHandler, DrawingTool, SerializedDrawing } from "@/core/chart/drawings/types";
import { ConnectionState, ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { AppState, ChartSettings, Product } from "@/components/chart/context";

export type Action =
    // -----------ROOM LOGIC----------
    | { type: "CREATE_COLLAB_ROOM", payload: { roomId: string } }
    | { type: "USER_JOINED", payload: { displayName: string } }
    | { type: "USER_LEFT", payload: { displayName: string } }
    | { type: "SYNC_FULL_STATE", payload: { state: AppState } }
    | { type: "JOIN_COLLAB_ROOM", payload: { roomId: string | null } }
    | { type: "LEAVE_COLLAB_ROOM", payload: null }
    | { type: "END_LOADING", payload: null }
    | { type: "SET_CONNECTION_STATUS_COLLAB", payload: { status: ConnectionStatus } }

    // -----------DRAWING LOGIC----------
    | { type: "ADD_DRAWING", payload: { drawing: SerializedDrawing } }
    | { type: "DELETE_DRAWING", payload: { drawing: SerializedDrawing } }
    | { type: "SELECT_DRAWING", payload: { drawing: BaseDrawing | null } }
    | { type: "START_TOOL", payload: { tool: DrawingTool, handler: BaseDrawingHandler } }
    | { type: "CANCEL_TOOL", payload: null }
    | { type: "INTIALIZE_DRAWINGS", payload: { drawings: SerializedDrawing[] } }

    // -----------CHART LOGIC----------
    | { type: "SELECT_CHART", payload: { product: Product, timeframe: IntervalKey } }
    | { type: "TOGGLE_SETTINGS", payload: { state: boolean } }
    | { type: "SET_TIMEZONE", payload: string }
    | { type: "TOGGLE_TICKER_SEARCH_BOX", payload: { state: boolean } }
    | { type: "TOGGLE_TICKER_SEARCH_BOX_AND_SET_TERM", payload: string }
    | { type: "TOGGLE_COLLAB_WINDOW", payload: { state: boolean } }
    | { type: "UPDATE_SETTINGS", payload: { settings: ChartSettings } }
    | { type: "CLEANUP_STATE", payload: null }
    | { type: "SET_CONNECTION_STATE_CHART", payload: { state: ConnectionState } }


function mergeDrawings(local: SerializedDrawing[], incoming: SerializedDrawing[]): SerializedDrawing[] {
    const map = new Map<string, SerializedDrawing>();
    [...local, ...incoming].forEach(d => {
        const existing = map.get(d.id);
        if (!existing) {
            map.set(d.id, d);
            return;
        }
        if (d.isDeleted) {
            existing.isDeleted = true;
        }
    });
    return Array.from(map.values()).filter(d => !d.isDeleted);
}

function mergeStates(local: AppState, incoming: Partial<AppState>): AppState {
    const mergedState: AppState = deepMerge({}, local);
    deepMerge(mergedState, incoming);

    if (incoming.chart?.drawings?.collection) {
        mergedState.chart.drawings.collection = mergeDrawings(
            local.chart.drawings.collection,
            incoming.chart?.drawings.collection
        );
    }

    return mergedState;
}

export function deepMerge(target: any, source: any) {
    if (source === null || source === undefined) return target;
    if (target === null || target === undefined) return source;

    if (typeof target !== 'object' || typeof source !== 'object') return source;

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] instanceof Object && key in target) {
                target[key] = deepMerge(target[key], source[key])
            } else {
                target[key] = source[key];
            }
        }
    }
    return target
}

export function Reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_CONNECTION_STATE_CHART": {
            return {
                ...state,
                chart: {
                    ...state.chart,
                    data: {
                        ...state.chart.data,
                        state: action.payload.state
                    }
                }
            }
        }

        case "SET_CONNECTION_STATUS_COLLAB": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        status: action.payload.status
                    }
                }
            }
        }


        case "USER_JOINED": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        activeUsers: [...action.payload.displayName, ...state.collaboration.room.activeUsers]
                    }
                }
            }
        }

        case "USER_LEFT": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        activeUsers: state.collaboration.room.activeUsers.filter(u => u !== action.payload.displayName)
                    }
                }
            }
        }

        case "SYNC_FULL_STATE": {
            return mergeStates(state, action.payload.state)
        }

        case "END_LOADING": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        isLoading: false
                    }
                }
            }

        }

        case "ADD_DRAWING": {
            return {
                ...state,
                tools: {
                    ...state.tools,
                    activeTool: null,
                    activeHandler: null
                },
                chart: {
                    ...state.chart,
                    drawings: {
                        ...state.chart.drawings,
                        collection: [...state.chart.drawings.collection, action.payload.drawing]
                    }
                }
            }
        }

        case "DELETE_DRAWING": {
            return {
                ...state,
                chart: {
                    ...state.chart,
                    drawings: {
                        collection: state.chart.drawings.collection.filter(d => d.id !== action.payload.drawing.id),
                        selected: null
                    },
                }
            }
        }

        case "START_TOOL": {
            return {
                ...state,
                tools: {
                    ...state.tools,
                    activeTool: action.payload.tool,
                    activeHandler: action.payload.handler
                },
                chart: {
                    ...state.chart,
                }
            }
        }

        case "CANCEL_TOOL": {
            return {
                ...state,
                tools: {
                    ...state.tools,
                    activeTool: null,
                    activeHandler: null,
                },
                chart: {
                    ...state.chart,
                }
            }
        }

        case "SELECT_CHART": {
            state.tools.activeHandler?.onCancel()
            return {
                ...state,
                chart: {
                    ...state.chart,
                    id: `${action.payload.product.name.toLowerCase()}:${action.payload.product.exchange.toLowerCase()}`,
                    drawings: {
                        ...state.chart.drawings,
                        selected: null,
                    },
                    data: {
                        ...state.chart.data,
                        product: action.payload.product,
                        timeframe: action.payload.timeframe,
                    }
                }
            }
        }

        case "SELECT_DRAWING": {
            return {
                ...state,
                chart: {
                    ...state.chart,
                    drawings: {
                        ...state.chart.drawings,
                        selected: action.payload.drawing
                    }
                }
            }
        }

        case "TOGGLE_SETTINGS": {
            return {
                ...state,
                settings: {
                    ...state.settings,
                    isOpen: action.payload.state
                },
                chart: {
                    ...state.chart,
                }
            }
        }

        case "TOGGLE_TICKER_SEARCH_BOX": {
            return {
                ...state,
                tickerSearchBox: {
                    ...state.tickerSearchBox,
                    isOpen: action.payload.state
                },
            }
        }

        case "TOGGLE_TICKER_SEARCH_BOX_AND_SET_TERM": {
            return {
                ...state,
                tickerSearchBox: {
                    isOpen: true,
                    searchTerm: action.payload
                },
            }
        }

        case "TOGGLE_COLLAB_WINDOW": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    isOpen: action.payload.state
                }
            }
        }

        case "CREATE_COLLAB_ROOM": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        id: action.payload.roomId,
                        isHost: true,
                    }
                }
            }
        }

        case "JOIN_COLLAB_ROOM": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        id: action.payload.roomId,
                    }
                }
            }
        }

        case "LEAVE_COLLAB_ROOM": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    room: {
                        ...state.collaboration.room,
                        id: null,
                        isHost: false,
                    }
                }
            }
        }

        case "UPDATE_SETTINGS": {
            return {
                ...state,
                settings: {
                    ...action.payload.settings
                },
                chart: {
                    ...state.chart,
                }
            }
        }

        case "SET_TIMEZONE": {
            return {
                ...state,
                settings: {
                    ...state.settings,
                    timezone: action.payload
                },
            }
        }

        case "INTIALIZE_DRAWINGS": {
            return {
                ...state,
                chart: {
                    ...state.chart,
                    drawings: {
                        ...state.chart.drawings,
                        collection: action.payload.drawings
                    }
                }
            }
        }

        case "CLEANUP_STATE": {
            return {
                ...state,
                collaboration: {
                    ...state.collaboration,
                    isOpen: false,
                    room: {
                        ...state.collaboration.room,
                        id: null,
                        activeUsers: [],
                        isHost: false,
                    }
                },
                tools: {
                    activeTool: null,
                    activeHandler: null
                },
                settings: {
                    ...state.settings,
                    isOpen: false
                },
                chart: {
                    ...state.chart,
                    drawings: {
                        ...state.chart.drawings,
                        selected: null,
                    }
                }

            }
        }

        default: {
            return state
        }
    }
}
