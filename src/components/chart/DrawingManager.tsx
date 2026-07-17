'use client';

import { Eye, EyeOff, Lock, LockOpen, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { BaseDrawing } from '@/core/chart/drawings/primitives/BaseDrawing';
import { DrawingType } from '@/core/chart/types';
import { DRAWING_TYPE_META } from './drawingMeta';
import { logger } from '@/lib/logger';

// Scroll the time scale so the drawing sits in the middle of the current view,
// preserving the existing zoom. Best-effort: only runs when the chart exposes a
// numeric (UTC-timestamp) visible range, which is the case for our feeds.
function focusDrawing(drawing: BaseDrawing) {
  const chartApi = useChartStore.getState().chartApi;
  if (!chartApi || drawing.points.length === 0) return;
  try {
    const times = drawing.points.map((p) => Number(p.time));
    if (times.some((t) => Number.isNaN(t))) return;
    const center = (Math.min(...times) + Math.max(...times)) / 2;

    const ts = chartApi.timeScale();
    const range = ts.getVisibleRange();
    if (range && typeof range.from === 'number' && typeof range.to === 'number') {
      const half = (range.to - range.from) / 2;
      ts.setVisibleRange({
        from: (center - half) as never,
        to: (center + half) as never,
      });
    }
  } catch (e) {
    logger.error('failed to focus drawing: ', e);
  }
}

function DrawingRow({ drawing, selected }: { drawing: BaseDrawing; selected: boolean }) {
  const selectOnly = useChartStore((s) => s.selectOnly);
  const deleteDrawing = useChartStore((s) => s.deleteDrawing);

  const type = drawing.serialize().type as DrawingType;
  const meta = DRAWING_TYPE_META[type];
  const Icon = meta?.icon;
  // Prefer a text drawing's own label; fall back to the type name.
  const label = (type === DrawingType.TEXT && drawing.options.labelText) || meta?.label || type;

  const handleSelect = () => {
    selectOnly(drawing.id);
    focusDrawing(drawing);
  };

  return (
    <div
      onClick={handleSelect}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
    >
      {Icon && <Icon size={16} className="shrink-0" />}
      <span className="flex-1 truncate">{label}</span>

      <button
        type="button"
        title={drawing.isVisible ? 'Hide' : 'Show'}
        aria-label={drawing.isVisible ? 'Hide drawing' : 'Show drawing'}
        className={`shrink-0 p-1 rounded hover:bg-background/60 ${drawing.isVisible ? 'opacity-60 group-hover:opacity-100' : 'text-foreground'}`}
        onClick={(e) => { e.stopPropagation(); drawing.setVisible(!drawing.isVisible); }}
      >
        {drawing.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>

      <button
        type="button"
        title={drawing.isLocked ? 'Unlock' : 'Lock'}
        aria-label={drawing.isLocked ? 'Unlock drawing' : 'Lock drawing'}
        className={`shrink-0 p-1 rounded hover:bg-background/60 ${drawing.isLocked ? 'text-foreground' : 'opacity-60 group-hover:opacity-100'}`}
        onClick={(e) => { e.stopPropagation(); drawing.setLocked(!drawing.isLocked); }}
      >
        {drawing.isLocked ? <Lock size={15} /> : <LockOpen size={15} />}
      </button>

      <button
        type="button"
        title="Delete"
        aria-label="Delete drawing"
        className="shrink-0 p-1 rounded text-destructive opacity-60 group-hover:opacity-100 hover:bg-destructive/10"
        onClick={(e) => { e.stopPropagation(); deleteDrawing(drawing.id); }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function DrawingManager() {
  const isOpen = useUIStore((s) => s.drawingManager.isOpen);
  const toggleDrawingManager = useUIStore((s) => s.toggleDrawingManager);
  const drawings = useChartStore((s) => s.drawings);

  if (!isOpen) return null;

  const rows = Array.from(drawings.collection.values());

  return (
    <div className="w-64 shrink-0 flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground">
          Drawings {rows.length > 0 && <span className="text-muted-foreground font-normal">({rows.length})</span>}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close" onClick={() => toggleDrawingManager(false)}>
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center px-4 py-8">
            No drawings yet. Use the tools on the left to add some.
          </p>
        ) : (
          rows.map((drawing) => (
            <DrawingRow key={drawing.id} drawing={drawing} selected={drawings.selected === drawing.id} />
          ))
        )}
      </div>
    </div>
  );
}
