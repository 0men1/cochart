import { CollabSocket } from "@/core/chart/collaboration/collabSocket";
import { logger } from "@/lib/logger";
import { ConnectionStatus } from "@/core/chart/market-data/types";
import { create } from "zustand";
import { useChartStore } from "./useChartStore";
import { useIdentityStore } from "./useIdentityStore";
import { CollabAction, PresenceUser } from "./types";

export interface PeerCursor {
  time: number;
  price: number;
}

interface CollabState {
  isOpen: boolean;
  roomId: string | null,
  isHost: boolean,
  isLoading: boolean,
  activeUsers: PresenceUser[]
  peerCursors: Record<string, PeerCursor>;
  socket: CollabSocket | null;
  status: ConnectionStatus;
  setRoom: (roomId: string, isHost: boolean) => void;
  setCollabConnectionStatus: (status: ConnectionStatus) => void;
  connectSocket: (roomId: string) => void;
  disconnectSocket: () => void;
  toggleCollabWindow: (isOpen: boolean) => void;
  broadcastPresence: () => void;
  broadcastCursor: (time: number, price: number, hidden?: boolean) => void;
}

export const useCollabStore = create<CollabState>((set, get) => ({
  isOpen: false,
  roomId: null,
  isLoading: false,
  isHost: false,
  activeUsers: [],
  peerCursors: {},
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
    // Set roomId up front so drawing persistence knows we're in a room from
    // the first render (before the socket finishes opening).
    set({ socket, roomId, status: ConnectionStatus.CONNECTING });

    // Identify ourselves to the room with this browser's anonymous identity.
    const identity = useIdentityStore.getState().identity;

    socket.connect(roomId, identity, {
      onOpen: () => {
        set({ roomId, status: ConnectionStatus.CONNECTED });

        // The host seeds the room's initial truth with its current chart.
        if (get().isHost) {
          const chart = useChartStore.getState();
          const drawings = Array.from(chart.drawings.collection.values())
            .map((d) => d.serialize());
          const indicators = Array.from(chart.indicators.collection.values());
          socket.send({
            type: CollabAction.INIT_ROOM,
            payload: {
              product: chart.data.product,
              timeframe: chart.data.timeframe,
              drawings,
              indicators,
            },
          });
        }
      },
      onMessage: (data) => {
        const incomingAction = typeof data === 'string'
          ? JSON.parse(data)
          : data;

        const { syncChart, syncModifyDrawing,
          syncAddDrawing, syncDeleteDrawing,
          syncUpsertIndicator, syncRemoveIndicator } = useChartStore.getState();

        // Presence is independent of chart state — always apply the latest
        // roster, even while a snapshot decision is pending. Prune cursors for
        // anyone who has left so departed peers don't leave a stale marker.
        if (incomingAction.type === CollabAction.PRESENCE) {
          const users: PresenceUser[] = incomingAction.payload?.users ?? [];
          const present = new Set(users.map((u) => u.userId));
          const peerCursors = get().peerCursors;
          const pruned = Object.fromEntries(
            Object.entries(peerCursors).filter(([id]) => present.has(id)),
          );
          set({ activeUsers: users, peerCursors: pruned });
          return;
        }

        // Live cursor updates are ephemeral and independent of chart/snapshot
        // state — apply them straight away and never persist.
        if (incomingAction.type === CollabAction.CURSOR) {
          const { userId, time, price, hidden } = incomingAction.payload ?? {};
          const myId = useIdentityStore.getState().identity?.userId;
          if (!userId || userId === myId) return;
          const peerCursors = { ...get().peerCursors };
          if (hidden || typeof time !== 'number' || typeof price !== 'number') {
            delete peerCursors[userId];
          } else {
            peerCursors[userId] = { time, price };
          }
          set({ peerCursors });
          return;
        }

        switch (incomingAction.type) {
          case CollabAction.SNAPSHOT: {
            // Always adopt the room's authoritative state, replacing whatever is
            // on screen. Room state is never written to IndexedDB (the in-room
            // guard in useChartDrawings pauses persistence), so the user's own
            // saved drawings are untouched and restored when they leave.
            const { product, timeframe, drawings, indicators } = incomingAction.payload;
            useChartStore.getState().syncSnapshot(product, timeframe, drawings ?? [], indicators ?? []);
            break;
          }
          case CollabAction.SELECT_CHART:
            syncChart(incomingAction.payload.product, incomingAction.payload.timeframe);
            break;
          case CollabAction.ADD_DRAWING:
            syncAddDrawing(incomingAction.payload.drawing);
            break;
          case CollabAction.DELETE_DRAWING:
            syncDeleteDrawing(incomingAction.payload.drawingId);
            break;
          case CollabAction.MODIFY_DRAWING:
            syncModifyDrawing(incomingAction.payload.drawing);
            break;
          case CollabAction.ADD_INDICATOR:
          case CollabAction.MODIFY_INDICATOR:
            syncUpsertIndicator(incomingAction.payload.indicator);
            break;
          case CollabAction.REMOVE_INDICATOR:
            syncRemoveIndicator(incomingAction.payload.indicatorId);
            break;

        }
      },
      onClose: () => {
        set({ status: ConnectionStatus.DISCONNECTED });
      },
      onError: (error) => {
        logger.error("connection error: ", error);
        set({ status: ConnectionStatus.ERROR });
      },
      onReconnecting: () => {
        set({ status: ConnectionStatus.RECONNECTING });
      }
    });
  },
  broadcastPresence: () => {
    const socket = get().socket;
    if (!socket) return;
    const identity = useIdentityStore.getState().identity;
    if (!identity) return;
    socket.send({
      type: CollabAction.UPDATE_PRESENCE,
      payload: {
        userId: identity.userId,
        displayName: identity.displayName,
        color: identity.color,
      },
    });
  },
  broadcastCursor: (time: number, price: number, hidden?: boolean) => {
    const socket = get().socket;
    if (!socket) return;
    const identity = useIdentityStore.getState().identity;
    if (!identity) return;
    socket.send({
      type: CollabAction.CURSOR,
      payload: { userId: identity.userId, time, price, hidden },
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
        activeUsers: [],
        peerCursors: {},
      });
      // Drop the room's drawings; the IndexedDB restore effect re-runs on
      // roomId -> null and brings back the user's own saved drawings.
      // Indicators are intentionally left in place: they have no persistence to
      // restore from, so clearing them here would just lose the user's work.
      useChartStore.getState().clearDrawings();
    }
  },
}))
