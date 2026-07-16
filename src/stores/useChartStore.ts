import { SerializedDrawing } from "@/core/chart/drawings/types";
import { logger } from "@/lib/logger";
import { CollabAction, ChartSettings, Product } from "./types";
import { ConnectionState, ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { CrosshairMode, LineStyle, IChartApi, ISeriesApi, SeriesType } from "cochart-charts";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { useCollabStore } from "./useCollabStore";
import { restoreDrawing } from "@/components/chart/hooks/useChartDrawings";
import { enableMapSet, setAutoFreeze, Draft } from "immer";
import { DrawingType } from "@/core/chart/types";
import { BaseDrawingHandler } from "@/core/chart/drawings/DrawingHandlerFactory";
import { deepMerge } from "./mergeSettings";

interface DataState {
  product: Product
  style: string;
  timeframe: IntervalKey;
  connectionState: ConnectionState;
}

interface ToolState {
  activeTool: DrawingType | null,
  activeHandler: BaseDrawingHandler | null,
}

export const defaultSettings: ChartSettings = {
  isOpen: false,
  cursor: CrosshairMode.Normal,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  layout: {
    fontSize: 12,
  },
  background: {
    theme: "dark",
    grid: {
      vertLines: {
        visible: true,
        color: '#D6DCDE',
        style: LineStyle.Solid,
      },
      horzLines: {
        visible: true,
        color: '#D6DCDE',
        style: LineStyle.Solid,
      }
    },
  },
  crosshair: {
    vertLine: {
      visible: true,
      color: '#758696',
      width: 1,
      style: LineStyle.LargeDashed,
    },
    horzLine: {
      visible: true,
      color: '#758696',
      width: 1,
      style: LineStyle.LargeDashed,
    },
  },
  candles: {
    upColor: '#26a69a',
    downColor: '#ef5350',
    wickVisible: true,
    wickupColor: '#26a69a',
    wickDownColor: '#ef5350',
    borderVisible: false,
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
  },
}


interface ChartState {
  id: string;
  drawings: {
    collection: Map<string, BaseDrawing>;
    selected: string | null;
    updatedAt: number;
  };
  data: DataState;
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
  tools: ToolState;
  chartSettings: ChartSettings;
  setChartSettings: (settings: Partial<ChartSettings>) => void;
  toggleChartSettings: (isOpen: boolean) => void;
  setTimezone: (timezone: string) => void;
  setProduct: (product: Product) => void;
  selectChart: (product: Product, timeframe: IntervalKey) => void;
  setInstances: (chartApi: IChartApi | null, seriesApi: ISeriesApi<SeriesType> | null) => void;
  setDataConnectionState: (state: ConnectionState) => void;
  addDrawing: (drawing: BaseDrawing) => void;
  deleteDrawing: (drawingId: string) => void;
  deleteSelectedDrawing: () => void;
  selectDrawing: (drawingId: string | null) => void;
  deselectDrawing: () => void;
  modifyDrawing: (newDrawing: BaseDrawing) => void;
  startTool: (tool: DrawingType, handler: BaseDrawingHandler | null) => void;
  cancelTool: () => void;
  undo: () => void;
  redo: () => void;
  syncChart: (product: Product, timeframe: IntervalKey) => void;
  syncSnapshot: (product: Product, timeframe: IntervalKey, drawings: SerializedDrawing[], mode?: 'replace' | 'keep') => void;
  clearDrawings: () => void;
  syncAddDrawing: (drawings: SerializedDrawing) => void;
  syncDeleteDrawing: (drawingId: string) => void;
  syncModifyDrawing: (drawing: SerializedDrawing) => void;
}

const defaultData: DataState = {
  product: {
    symbol: "SOL-USD",
    name: "SOLUSD",
    exchange: "coinbase",
  },
  style: 'candle',
  timeframe: "1m",
  connectionState: { status: ConnectionStatus.DISCONNECTED, reconnectAttempts: 0 },
}

enableMapSet();
setAutoFreeze(false);

// Detach every drawing from the live series and empty the collection. Used when
// switching tickers (drawings are per-ticker) and by clearDrawings. delete()
// detaches from the current series; instances stranded on a disposed series are
// simply dropped when the map is cleared.
function detachAndClearDrawings(state: Draft<ChartState>) {
  for (const drawing of state.drawings.collection.values()) {
    if (drawing.isAttached && drawing.series === state.seriesApi) {
      try { drawing.delete(); } catch (e) { logger.error(e); }
    }
  }
  state.drawings.collection.clear();
  state.drawings.selected = null;
  state.drawings.updatedAt = Date.now();
  // History is per-ticker/room; don't let undo resurrect a prior context's drawings.
  resetHistory();
}

// ---------------------------------------------------------------------------
// Undo/redo history (module-scoped, non-reactive). Records ONLY local drawing
// actions (add/modify/delete); remote `sync*` actions are never recorded so
// undo can't fight collaborators. `snapshots` holds the last-committed
// serialized state per drawing id, used to compute a modify's "before".
// ---------------------------------------------------------------------------
type DrawCommand =
  | { op: 'add'; after: SerializedDrawing }
  | { op: 'delete'; before: SerializedDrawing }
  | { op: 'modify'; before: SerializedDrawing; after: SerializedDrawing };

const historyUndo: DrawCommand[] = [];
const historyRedo: DrawCommand[] = [];
const snapshots = new Map<string, SerializedDrawing>();
let applyingHistory = false;

// Suppress recording while inverting a command or restoring from storage, so
// undo/redo and load don't push new history entries.
export function suppressHistory<T>(fn: () => T): T {
  const prev = applyingHistory;
  applyingHistory = true;
  try { return fn(); } finally { applyingHistory = prev; }
}

function resetHistory() {
  historyUndo.length = 0;
  historyRedo.length = 0;
  snapshots.clear();
}

function recordAdd(drawing: BaseDrawing) {
  const after = drawing.serialize();
  snapshots.set(after.id, after);
  if (applyingHistory) return;
  historyUndo.push({ op: 'add', after });
  historyRedo.length = 0;
}

function recordModify(drawing: BaseDrawing) {
  const after = drawing.serialize();
  const before = snapshots.get(after.id);
  snapshots.set(after.id, after);
  if (applyingHistory || !before) return;
  historyUndo.push({ op: 'modify', before, after });
  historyRedo.length = 0;
}

function recordDelete(before: SerializedDrawing | undefined) {
  if (!before) return;
  snapshots.delete(before.id);
  if (applyingHistory) return;
  historyUndo.push({ op: 'delete', before });
  historyRedo.length = 0;
}

export const useChartStore = create<ChartState>()(
  persist(
    immer((set) => ({
      id: `${defaultData.product.symbol}:${defaultData.product.exchange}`,
      data: defaultData,
      drawings: {
        collection: new Map(),
        selected: null,
        updatedAt: Date.now()
      },
      chartApi: null,
      seriesApi: null,
      tools: {
        activeTool: null,
        activeHandler: null
      },
      chartSettings: {
        ...defaultSettings,
        isOpen: false
      },
      setChartSettings: (settings: Partial<ChartSettings>) => {
        set((state) => ({
          chartSettings: {
            ...state.chartSettings,
            ...settings
          }
        }))
      },
      toggleChartSettings: (isOpen: boolean) => {
        set((state) => ({
          chartSettings: {
            ...state.chartSettings,
            isOpen: isOpen
          }
        }))
      },
      setTimezone: (timezone: string) => set((state) => ({
        chartSettings: {
          ...state.chartSettings,
          timezone
        }
      })),
      setProduct: (product: Product) => set((state) => {
        state.data.product = product;
      }),
      selectChart: (product: Product, timeframe: IntervalKey) => {
        set((state) => {
          const sameChart =
            state.data.product.symbol === product.symbol &&
            state.data.product.exchange === product.exchange &&
            state.data.timeframe === timeframe;
          if (sameChart) return;
          const newId = `${product.symbol}:${product.exchange}`;
          const tickerChanged = state.id !== newId;
          state.id = newId;
          state.data.product = product;
          state.data.timeframe = timeframe;
          // Drawings are per-ticker; drop the outgoing ticker's instances so they
          // can't leak onto (and later clone on) the recreated series.
          if (tickerChanged) detachAndClearDrawings(state);
        });

        // Side effects go outside the set function
        const { socket, status } = useCollabStore.getState();
        if (status === ConnectionStatus.CONNECTED && socket) {
          // CollabSocket.send stringifies; passing a string here would
          // double-encode and the server would fail to parse the action.
          socket.send({
            type: CollabAction.SELECT_CHART,
            payload: { product, timeframe }
          });
        }
      },
      syncChart: (product: Product, timeframe: IntervalKey) => {
        set((state) => {
          const sameChart =
            state.data.product.symbol === product.symbol &&
            state.data.product.exchange === product.exchange &&
            state.data.timeframe === timeframe;
          if (sameChart) return;
          const newId = `${product.symbol}:${product.exchange}`;
          const tickerChanged = state.id !== newId;
          state.id = newId;
          state.data.product = product;
          state.data.timeframe = timeframe;
          // Drawings are per-ticker; drop the outgoing ticker's instances so they
          // can't leak onto (and later clone on) the recreated series.
          if (tickerChanged) detachAndClearDrawings(state);
        });
      },
      syncSnapshot: (product: Product, timeframe: IntervalKey, drawings: SerializedDrawing[], mode: 'replace' | 'keep' = 'replace') => {
        set((state) => {
          // Adopt the room's authoritative chart selection. Skip when already
          // on the room's chart — assigning a fresh product object would tear
          // down and recreate the chart for nothing.
          const sameChart =
            state.data.product.symbol === product?.symbol &&
            state.data.product.exchange === product?.exchange &&
            state.data.timeframe === timeframe;
          if (product && timeframe && !sameChart) {
            state.id = `${product.symbol}:${product.exchange}`;
            state.data.product = product;
            state.data.timeframe = timeframe;
          }

          // 'replace' discards local drawings; 'keep' leaves them in the
          // collection (in-memory only — never broadcast or persisted).
          // delete() detaches from the drawing's series, which is only safe
          // against the live one; for drawings stuck on a disposed chart,
          // dropping the reference is enough.
          if (mode === 'replace') {
            for (const drawing of state.drawings.collection.values()) {
              if (drawing.isAttached && drawing.series === state.seriesApi) {
                try { drawing.delete(); } catch (e) { logger.error(e); }
              }
            }
            state.drawings.collection.clear();
            state.drawings.selected = null;
            // Undo shouldn't cross the boundary into the replaced room state.
            resetHistory();
          }

          // Room drawings win on id collision; detach the displaced local
          // instance so it doesn't linger on the canvas.
          for (const sd of drawings ?? []) {
            const inst = restoreDrawing(sd);
            if (!inst) continue;
            const existing = state.drawings.collection.get(inst.id);
            if (existing && existing.isAttached && existing.series === state.seriesApi) {
              try { existing.delete(); } catch (e) { logger.error(e); }
            }
            state.drawings.collection.set(inst.id, inst);
          }
          state.drawings.updatedAt = Date.now();
        });
      },
      clearDrawings: () => {
        set((state) => {
          detachAndClearDrawings(state);
        });
      },
      syncAddDrawing: (drawing: SerializedDrawing) => {
        set((state) => {
          const baseDrawing = restoreDrawing(drawing);
          if (!baseDrawing) return;
          state.drawings.collection.set(drawing.id, baseDrawing);
          state.drawings.updatedAt = Date.now();
        });
        // Keep the snapshot in sync with remote state so a later local modify
        // computes a correct "before" for undo.
        snapshots.set(drawing.id, drawing);
      },
      syncDeleteDrawing: (drawingId: string) => {
        set((state) => {
          const drawing = state.drawings.collection.get(drawingId);
          if (drawing) { drawing.delete(); }
          state.drawings.collection.delete(drawingId);
          state.drawings.updatedAt = Date.now();
          if (state.drawings.selected === drawingId) {
            state.drawings.selected = null;
          }
        });
        snapshots.delete(drawingId);
      },
      syncModifyDrawing: (drawing: SerializedDrawing) => {
        set((state) => {
          const existingDrawing = state.drawings.collection.get(drawing.id);
          // Apply both points AND options so remote color/width edits land, not
          // just position changes.
          existingDrawing?.syncFrom(drawing.points, drawing.options);
          state.drawings.updatedAt = Date.now();
          snapshots.set(drawing.id, drawing);
        })
      },
      setInstances: (chartApi, seriesApi) => set((state) => {
        state.chartApi = chartApi;
        state.seriesApi = seriesApi;
      }),
      setDataConnectionState: (connectionState) => set((state) => {
        state.data.connectionState = connectionState;
      }),
      addDrawing: (drawing: BaseDrawing) => {
        set((state) => {
          state.drawings.collection.set(drawing.id, drawing);
          state.drawings.updatedAt = Date.now();
        });
        recordAdd(drawing);

        const { socket, status } = useCollabStore.getState();
        if (status === ConnectionStatus.CONNECTED && socket) {
          socket.send({
            type: CollabAction.ADD_DRAWING,
            payload: { drawing: drawing.serialize() }
          });
        }
      },
      modifyDrawing: (newDrawing: BaseDrawing) => set((state) => {
        recordModify(newDrawing);
        const existingDrawing = state.drawings.collection.get(newDrawing.id);
        existingDrawing?.updatePoints(newDrawing.points);
        state.drawings.updatedAt = Date.now();

        const { socket, status } = useCollabStore.getState();
        if (status === ConnectionStatus.CONNECTED && socket) {
          socket.send({
            type: CollabAction.MODIFY_DRAWING,
            payload: { drawing: newDrawing.serialize() }
          });
        }
      }),
      selectDrawing: (drawingId: string | null) => set((state) => {
        logger.debug("selecting drawing " + drawingId)
        state.drawings.selected = drawingId;
      }),
      deselectDrawing: () => {
        const selected = useChartStore.getState().drawings.selected;
        if (!selected) return;
        // Clear the instance's selected flag so its control points stop
        // rendering. setSelected(false) fires a SELECT notification whose
        // listener re-selects in the store, so null the store selection right
        // after (sequential top-level sets — never nested inside one recipe).
        useChartStore.getState().drawings.collection.get(selected)?.setSelected(false);
        set((state) => { state.drawings.selected = null; });
      },
      deleteDrawing: (drawingId: string) => set((state) => {
        const drawing = state.drawings.collection.get(drawingId);
        const before = drawing?.serialize();
        if (drawing) { drawing.delete(); }
        state.drawings.collection.delete(drawingId);
        state.drawings.selected = null;
        state.drawings.updatedAt = Date.now();
        recordDelete(before);

        const { socket, status } = useCollabStore.getState();
        if (status === ConnectionStatus.CONNECTED && socket) {
          socket.send({
            type: CollabAction.DELETE_DRAWING,
            payload: { drawingId: drawingId }
          });
        }
      }),
      deleteSelectedDrawing: () => set((state) => {
        if (state.drawings.selected) {
          state.deleteDrawing(state.drawings.selected)
        }
      }),
      startTool: (tool, handler) => set((state) => {
        state.tools.activeTool = tool;
        state.tools.activeHandler = handler;
      }),
      cancelTool: () => set((state) => {
        // Let the handler tear down any in-progress preview before we drop it.
        try { state.tools.activeHandler?.onCancel(); } catch (e) { logger.error(e); }
        state.tools.activeTool = null;
        state.tools.activeHandler = null;
      }),
      // Undo/redo invert a recorded command by replaying the existing store
      // actions (so broadcast + persistence + the reconcile effect all run),
      // with recording suppressed to avoid re-pushing history.
      undo: () => {
        const cmd = historyUndo.pop();
        if (!cmd) return;
        const store = useChartStore.getState();
        suppressHistory(() => {
          if (cmd.op === 'add') {
            store.deleteDrawing(cmd.after.id);
          } else if (cmd.op === 'delete') {
            const inst = restoreDrawing(cmd.before);
            if (inst) store.addDrawing(inst);
          } else {
            const inst = store.drawings.collection.get(cmd.after.id);
            if (inst) {
              inst.syncFrom(cmd.before.points, cmd.before.options);
              store.modifyDrawing(inst);
            }
          }
        });
        historyRedo.push(cmd);
      },
      redo: () => {
        const cmd = historyRedo.pop();
        if (!cmd) return;
        const store = useChartStore.getState();
        suppressHistory(() => {
          if (cmd.op === 'add') {
            const inst = restoreDrawing(cmd.after);
            if (inst) store.addDrawing(inst);
          } else if (cmd.op === 'delete') {
            store.deleteDrawing(cmd.before.id);
          } else {
            const inst = store.drawings.collection.get(cmd.after.id);
            if (inst) {
              inst.syncFrom(cmd.after.points, cmd.after.options);
              store.modifyDrawing(inst);
            }
          }
        });
        historyUndo.push(cmd);
      },
    })),
    {
      name: 'cochart-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ chartSettings: state.chartSettings }),
      skipHydration: true,
      // Deep-merge persisted settings over the current defaults so settings
      // added after a user's localStorage was written still get their default
      // values instead of coming back `undefined`. The modal always opens
      // closed regardless of what was persisted.
      merge: (persisted, current) => {
        const persistedSettings = (persisted as { chartSettings?: Partial<ChartSettings> } | undefined)?.chartSettings;
        return {
          ...current,
          chartSettings: {
            ...deepMerge(defaultSettings, persistedSettings ?? {}),
            isOpen: false,
          },
        };
      },
    }
  )
);
