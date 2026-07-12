import { CollabSocket } from "@/core/chart/collaboration/collabSocket";
import { ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { SerializedDrawing } from "@/core/chart/drawings/types";
import { getDrawings } from "@/lib/indexdb";
import { create } from "zustand";
import { useChartStore } from "./useChartStore";
import { useIdentityStore } from "./useIdentityStore";
import { CollabAction, PresenceUser, Product } from "./types";

// A room snapshot held back from the chart store until the user decides what
// to do with their existing drawings (replace vs keep alongside).
interface PendingSnapshot {
  product: Product;
  timeframe: IntervalKey;
  drawings: SerializedDrawing[];
  // True while IndexedDB is being checked for saved drawings worth
  // protecting; the prompt stays hidden until the check resolves.
  awaitingLocalCheck?: boolean;
}

interface CollabState {
  isOpen: boolean;
  roomId: string | null,
  isHost: boolean,
  isLoading: boolean,
  activeUsers: PresenceUser[]
  socket: CollabSocket | null;
  status: ConnectionStatus;
  pendingSnapshot: PendingSnapshot | null;
  setRoom: (roomId: string, isHost: boolean) => void;
  setCollabConnectionStatus: (status: ConnectionStatus) => void;
  connectSocket: (roomId: string) => void;
  disconnectSocket: () => void;
  toggleCollabWindow: (isOpen: boolean) => void;
  resolvePendingSnapshot: (mode: 'replace' | 'keep') => void;
}

export const useCollabStore = create<CollabState>((set, get) => ({
  isOpen: false,
  roomId: null,
  isLoading: false,
  isHost: false,
  activeUsers: [],
  socket: null,
  status: ConnectionStatus.DISCONNECTED,
  pendingSnapshot: null,
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
          socket.send({
            type: CollabAction.INIT_ROOM,
            payload: {
              product: chart.data.product,
              timeframe: chart.data.timeframe,
              drawings,
            },
          });
        }
      },
      onMessage: (data) => {
        const incomingAction = typeof data === 'string'
          ? JSON.parse(data)
          : data;

        const { syncChart, syncModifyDrawing,
          syncAddDrawing, syncDeleteDrawing } = useChartStore.getState();

        // Presence is independent of chart state — always apply the latest
        // roster, even while a snapshot decision is pending.
        if (incomingAction.type === CollabAction.PRESENCE) {
          set({ activeUsers: incomingAction.payload?.users ?? [] });
          return;
        }

        // While a snapshot awaits the user's replace/keep decision, fold
        // deltas into the pending payload instead of the chart store so the
        // snapshot is never stale by the time it's accepted.
        const pending = get().pendingSnapshot;
        if (pending) {
          switch (incomingAction.type) {
            case CollabAction.SNAPSHOT:
              set({ pendingSnapshot: incomingAction.payload });
              return;
            case CollabAction.SELECT_CHART:
              set({
                pendingSnapshot: {
                  ...pending,
                  product: incomingAction.payload.product,
                  timeframe: incomingAction.payload.timeframe,
                }
              });
              return;
            case CollabAction.ADD_DRAWING:
            case CollabAction.MODIFY_DRAWING: {
              const drawing = incomingAction.payload.drawing;
              if (!drawing?.id) return;
              set({
                pendingSnapshot: {
                  ...pending,
                  drawings: pending.drawings
                    .filter((d) => d.id !== drawing.id)
                    .concat(drawing),
                }
              });
              return;
            }
            case CollabAction.DELETE_DRAWING:
              set({
                pendingSnapshot: {
                  ...pending,
                  drawings: pending.drawings
                    .filter((d) => d.id !== incomingAction.payload.drawingId),
                }
              });
              return;
            default:
              return;
          }
        }

        switch (incomingAction.type) {
          case CollabAction.SNAPSHOT: {
            const { product, timeframe, drawings } = incomingAction.payload;

            // Drawings already on screen (client-side nav into a room):
            // prompt right away.
            if (useChartStore.getState().drawings.collection.size > 0) {
              set({ pendingSnapshot: { product, timeframe, drawings: drawings ?? [] } });
              break;
            }

            // Fresh page load: nothing is in memory (the in-room guard pauses
            // the IndexedDB restore), but the user may still have saved
            // drawings for the room's chart worth protecting. Hold the
            // snapshot (hidden prompt) while IndexedDB is checked, so deltas
            // arriving meanwhile are absorbed into the pending payload.
            set({
              pendingSnapshot: {
                product, timeframe,
                drawings: drawings ?? [],
                awaitingLocalCheck: true,
              }
            });
            const roomChartId = `${product.symbol}:${product.exchange}`;
            getDrawings(roomChartId).then((saved) => {
              const pending = get().pendingSnapshot;
              if (!pending) return;
              if (saved.length > 0) {
                // Put the saved drawings on screen (syncAddDrawing does not
                // broadcast) so the user sees what they'd be protecting,
                // then reveal the prompt.
                const { syncAddDrawing: restoreLocal } = useChartStore.getState();
                for (const sd of saved) restoreLocal(sd);
                set({ pendingSnapshot: { ...pending, awaitingLocalCheck: false } });
              } else {
                get().resolvePendingSnapshot('replace');
              }
            }).catch((e) => {
              console.error("failed to check saved drawings: ", e);
              get().resolvePendingSnapshot('replace');
            });
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
  resolvePendingSnapshot: (mode: 'replace' | 'keep') => {
    const pending = get().pendingSnapshot;
    if (!pending) return;
    useChartStore.getState().syncSnapshot(
      pending.product,
      pending.timeframe,
      pending.drawings,
      mode,
    );
    set({ pendingSnapshot: null });
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
        pendingSnapshot: null,
        activeUsers: [],
      });
      // Drop the room's drawings; the IndexedDB restore effect re-runs on
      // roomId -> null and brings back the user's own saved drawings.
      useChartStore.getState().clearDrawings();
    }
  },
}))
