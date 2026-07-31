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
import { restoreDrawing } from "@/core/chart/drawings/registry";
import { pixelNudgeDeltas, shiftPoints } from "@/core/chart/drawings/clipboard";
import { enableMapSet, setAutoFreeze, Draft } from "immer";
import { DrawingType, Point } from "@/core/chart/types";
import { BaseDrawingHandler, DrawingHandlerFactory } from "@/core/chart/drawings/DrawingHandlerFactory";
import { deepMerge } from "./mergeSettings";
import { IndicatorConfig, IndicatorParams, IndicatorStyle, IndicatorType } from "@/core/chart/indicators/types";
import { INDICATOR_META, nextIndicatorColor } from "@/core/chart/indicators/registry";
import { randomUUID } from "@/lib/utils";

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
        visible: false,
        color: '#D6DCDE',
        style: LineStyle.Solid,
      },
      horzLines: {
        visible: false,
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
    upColor: '#179b21',
    downColor: '#9f0a16',
    wickVisible: true,
    wickupColor: '#adb3b2',
    wickDownColor: '#adb3b2',
    borderVisible: false,
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
  },
  // Default number-key hotkeys, following the ToolBox order.
  hotkeys: {
    [DrawingType.VERTICAL_LINE]: '1',
    [DrawingType.HORIZONTAL_LINE]: '2',
    [DrawingType.TREND_LINE]: '3',
    [DrawingType.RAY]: '4',
    [DrawingType.RECTANGLE]: '5',
    [DrawingType.TRIANGLE]: '6',
    [DrawingType.FIBONACCI]: '7',
    [DrawingType.TEXT]: '8',
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
  indicators: {
    collection: Map<string, IndicatorConfig>;
    updatedAt: number;
  };
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
  duplicateDrawing: (drawingId: string) => void;
  deleteDrawing: (drawingId: string) => void;
  deleteSelectedDrawing: () => void;
  selectDrawing: (drawingId: string | null) => void;
  selectOnly: (drawingId: string) => void;
  deselectDrawing: () => void;
  modifyDrawing: (newDrawing: BaseDrawing) => void;
  startTool: (tool: DrawingType, handler: BaseDrawingHandler | null) => void;
  activateTool: (tool: DrawingType) => void;
  cancelTool: () => void;
  undo: () => void;
  redo: () => void;
  syncChart: (product: Product, timeframe: IntervalKey) => void;
  syncSnapshot: (product: Product, timeframe: IntervalKey, drawings: SerializedDrawing[], indicators?: IndicatorConfig[]) => void;
  clearDrawings: () => void;
  syncAddDrawing: (drawings: SerializedDrawing) => void;
  syncDeleteDrawing: (drawingId: string) => void;
  syncModifyDrawing: (drawing: SerializedDrawing) => void;
  applyPeerDrag: (drawingId: string, points: Point[]) => void;
  addIndicator: (type: IndicatorType) => void;
  removeIndicator: (id: string) => void;
  toggleIndicator: (id: string, enabled: boolean) => void;
  updateIndicatorParams: (id: string, params: IndicatorParams) => void;
  updateIndicatorStyle: (id: string, style: Partial<IndicatorStyle>) => void;
  syncUpsertIndicator: (config: IndicatorConfig) => void;
  syncRemoveIndicator: (id: string) => void;
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

type DrawCommand =
  | { op: 'add'; after: SerializedDrawing }
  | { op: 'delete'; before: SerializedDrawing }
  | { op: 'modify'; before: SerializedDrawing; after: SerializedDrawing };

const historyUndo: DrawCommand[] = [];
const historyRedo: DrawCommand[] = [];
const snapshots = new Map<string, SerializedDrawing>();
let applyingHistory = false;

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

function broadcastIndicator(type: CollabAction, payload: Record<string, unknown>) {
  const { socket, status } = useCollabStore.getState();
  if (status === ConnectionStatus.CONNECTED && socket) {
    socket.send({ type, payload });
  }
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
      indicators: {
        collection: new Map(),
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
      // Adopt the room's authoritative state, always replacing what's on screen.
      // Local drawings/indicators are only in memory here (persistence is paused
      // while in a room), so the user's saved drawings are untouched and restore
      // on leave.
      syncSnapshot: (product: Product, timeframe: IntervalKey, drawings: SerializedDrawing[], indicators: IndicatorConfig[] = []) => {
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

          // Discard local drawings. delete() detaches from the drawing's series,
          // which is only safe against the live one; for drawings stuck on a
          // disposed chart, dropping the reference is enough.
          for (const drawing of state.drawings.collection.values()) {
            if (drawing.isAttached && drawing.series === state.seriesApi) {
              try { drawing.delete(); } catch (e) { logger.error(e); }
            }
          }
          state.drawings.collection.clear();
          state.drawings.selected = null;
          // Undo shouldn't cross the boundary into the replaced room state.
          resetHistory();

          // Load the room's drawings.
          for (const sd of drawings ?? []) {
            const inst = restoreDrawing(sd);
            if (!inst) continue;
            state.drawings.collection.set(inst.id, inst);
          }
          state.drawings.updatedAt = Date.now();

          // Indicators are plain configs, so no restore/detach is needed — the
          // reconcile hook rebuilds series from the collection.
          state.indicators.collection.clear();
          for (const config of indicators ?? []) {
            state.indicators.collection.set(config.id, config);
          }
          state.indicators.updatedAt = Date.now();
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
      // Apply a peer's in-progress drag to the live drawing so it visibly moves.
      // Deliberately `set`-free and snapshot-free: syncFrom already repaints via
      // applyOptions and doesn't re-notify (no rebroadcast loop), and skipping the
      // store update avoids per-frame React churn / IndexedDB writes for this
      // ephemeral, high-frequency signal. The committing MODIFY_DRAWING is what
      // updates the authoritative store state.
      applyPeerDrag: (drawingId: string, points: Point[]) => {
        const drawing = useChartStore.getState().drawings.collection.get(drawingId);
        if (drawing) drawing.syncFrom(points, drawing.options);
      },
      // Indicators are config-driven and session-scoped: these actions mutate
      // the config collection; useChartIndicators reconciles the live chart
      // series from it. Multiple instances of the same type are allowed — each
      // add creates a fresh instance with its own id, params, and color.
      addIndicator: (type: IndicatorType) => {
        const config: IndicatorConfig = {
          id: randomUUID(),
          type,
          params: { ...INDICATOR_META[type].defaultParams },
          // Cycle the palette by instance count so new lines are distinct.
          style: { color: nextIndicatorColor(useChartStore.getState().indicators.collection.size) },
          enabled: true,
        };
        set((state) => {
          state.indicators.collection.set(config.id, config);
          state.indicators.updatedAt = Date.now();
        });
        broadcastIndicator(CollabAction.ADD_INDICATOR, { indicator: config });
      },
      removeIndicator: (id: string) => {
        set((state) => {
          state.indicators.collection.delete(id);
          state.indicators.updatedAt = Date.now();
        });
        broadcastIndicator(CollabAction.REMOVE_INDICATOR, { indicatorId: id });
      },
      // toggle/param/style edits all broadcast the full config as MODIFY (the
      // server upserts by id), matching how a drawing modify sends its whole
      // serialized form.
      toggleIndicator: (id: string, enabled: boolean) => {
        set((state) => {
          const config = state.indicators.collection.get(id);
          if (!config) return;
          config.enabled = enabled;
          state.indicators.updatedAt = Date.now();
        });
        const config = useChartStore.getState().indicators.collection.get(id);
        if (config) broadcastIndicator(CollabAction.MODIFY_INDICATOR, { indicator: config });
      },
      updateIndicatorParams: (id: string, params: IndicatorParams) => {
        set((state) => {
          const config = state.indicators.collection.get(id);
          if (!config) return;
          config.params = { ...config.params, ...params };
          state.indicators.updatedAt = Date.now();
        });
        const config = useChartStore.getState().indicators.collection.get(id);
        if (config) broadcastIndicator(CollabAction.MODIFY_INDICATOR, { indicator: config });
      },
      updateIndicatorStyle: (id: string, style: Partial<IndicatorStyle>) => {
        set((state) => {
          const config = state.indicators.collection.get(id);
          if (!config) return;
          config.style = { ...config.style, ...style };
          state.indicators.updatedAt = Date.now();
        });
        const config = useChartStore.getState().indicators.collection.get(id);
        if (config) broadcastIndicator(CollabAction.MODIFY_INDICATOR, { indicator: config });
      },
      // Non-broadcasting appliers for inbound remote changes (add/modify upsert,
      // remove deletes). The reconcile hook picks up collection/updatedAt changes.
      syncUpsertIndicator: (config: IndicatorConfig) => set((state) => {
        state.indicators.collection.set(config.id, config);
        state.indicators.updatedAt = Date.now();
      }),
      syncRemoveIndicator: (id: string) => set((state) => {
        state.indicators.collection.delete(id);
        state.indicators.updatedAt = Date.now();
      }),
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
      duplicateDrawing: (drawingId: string) => {
        const state = useChartStore.getState();
        const src = state.drawings.collection.get(drawingId);
        const series = state.seriesApi;
        if (!src || !series) return;
        const clip = src.serialize();
        let points = clip.points;
        if (state.chartApi && clip.points.length > 0) {
          const deltas = pixelNudgeDeltas(state.chartApi, series, clip.points[0], 16, -16);
          if (deltas) points = shiftPoints(clip.points, deltas.timeDelta, deltas.priceDelta);
        }
        const inst = restoreDrawing({ ...clip, id: randomUUID(), points, isDeleted: false });
        if (!inst) return;
        state.addDrawing(inst);
        state.selectOnly(inst.id);
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
      selectOnly: (drawingId: string) => {
        const { collection } = useChartStore.getState().drawings;
        for (const d of collection.values()) {
          if (d.id !== drawingId && d.isSelected()) d.setSelected(false);
        }
        collection.get(drawingId)?.setSelected(true);
        set((state) => { state.drawings.selected = drawingId; });
      },
      deselectDrawing: () => {
        const selected = useChartStore.getState().drawings.selected;
        if (!selected) return;
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
      activateTool: (tool: DrawingType) => {
        const s = useChartStore.getState();
        if (!s.chartApi || !s.seriesApi) return;
        if (s.tools.activeTool === tool) { s.cancelTool(); return; }
        if (s.tools.activeHandler) s.cancelTool();
        try {
          const handler = new DrawingHandlerFactory(s.chartApi, s.seriesApi).createHandler(tool);
          if (handler) s.startTool(tool, handler);
        } catch (e) {
          logger.error("failed to activate tool: ", e);
          s.cancelTool();
        }
      },
      cancelTool: () => set((state) => {
        try { state.tools.activeHandler?.onCancel(); } catch (e) { logger.error(e); }
        state.tools.activeTool = null;
        state.tools.activeHandler = null;
      }),
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
