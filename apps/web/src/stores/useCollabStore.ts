import { CollabSocket } from "@/core/chart/collaboration/collabSocket";
import { ConnectionStatus } from "@/core/chart/market-data/types";
import { create } from "zustand";
import { useChartStore } from "./useChartStore";
import { CollabAction } from "./types";

interface CollabState {
	isOpen: boolean;
	roomId: string | null,
	isHost: boolean,
	isLoading: boolean,
	activeUsers: string[]
	socket: CollabSocket | null;
	status: ConnectionStatus;
	setRoom: (roomId: string, isHost: boolean) => void;
	setCollabConnectionStatus: (status: ConnectionStatus) => void;
	connectSocket: (roomId: string) => void;
	disconnectSocket: () => void;
	toggleCollabWindow: (isOpen: boolean) => void;
}

export const useCollabStore = create<CollabState>((set, get) => ({
	isOpen: false,
	roomId: null,
	isLoading: false,
	isHost: false,
	activeUsers: [],
	socket: null,
	status: ConnectionStatus.DISCONNECTED,
	setRoom: (roomId: string, isHost: boolean) => {
		set({ roomId, isHost });
	},
	setCollabConnectionStatus: (status: ConnectionStatus) => set({ status: status }),
	toggleCollabWindow: (isOpen: boolean) => set(({
		isOpen: isOpen
	})),
	connectSocket: (roomId: string) => {

		if (get().socket) return;

		const socket = new CollabSocket();
		set({ socket, status: ConnectionStatus.CONNECTING });

		socket.connect(roomId, {
			onOpen: () => {
				set({ roomId, status: ConnectionStatus.CONNECTED });
			},
			onMessage: (data) => {
				const incomingAction = typeof data === 'string'
					? JSON.parse(data)
					: data;

				const { syncChart, syncAddDrawing, syncDeleteDrawing } = useChartStore.getState();
				switch (incomingAction.type) {
					case CollabAction.SELECT_CHART:
						syncChart(incomingAction.payload.product, incomingAction.payload.timeframe);
						break;
					case CollabAction.ADD_DRAWING:
						syncAddDrawing(incomingAction.payload.drawing);
						break;
					case CollabAction.DELETE_DRAWING:
						syncDeleteDrawing(incomingAction.payload.drawingId);
						break;
				}
			},
			onClose: () => {
				set({ status: ConnectionStatus.DISCONNECTED });
			},
			onError: (error) => {
				console.error("connection error: ", error);
				set({ status: ConnectionStatus.ERROR });
			}
		});
	},
	disconnectSocket: () => {
		const socket = get().socket;

		if (socket) {
			socket.disconnect();
			set({
				roomId: null,
				socket: null,
				isHost: false,
				status: ConnectionStatus.DISCONNECTED,
			});
		}
	},
}))
