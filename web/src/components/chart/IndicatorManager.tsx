'use client';

import { Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { IndicatorConfig } from '@/core/chart/indicators/types';
import { INDICATOR_META, indicatorLabel } from '@/core/chart/indicators/registry';

function IndicatorRow({ config }: { config: IndicatorConfig }) {
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleIndicator = useChartStore((s) => s.toggleIndicator);
  const openIndicatorSettings = useUIStore((s) => s.openIndicatorSettings);

  const meta = INDICATOR_META[config.type];
  const Icon = meta.icon;

  return (
    <div
      onClick={() => openIndicatorSettings(config.id)}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon size={16} className="shrink-0" />
      {meta.supportsColor && (
        <span
          className="shrink-0 w-2.5 h-2.5 rounded-full border border-border"
          style={{ backgroundColor: config.style.color }}
        />
      )}
      <span className="flex-1 truncate">{indicatorLabel(config)}</span>

      <button
        type="button"
        title={config.enabled ? 'Hide' : 'Show'}
        aria-label={config.enabled ? 'Hide indicator' : 'Show indicator'}
        className={`shrink-0 p-1 rounded hover:bg-background/60 ${config.enabled ? 'opacity-60 group-hover:opacity-100' : 'text-foreground'}`}
        onClick={(e) => { e.stopPropagation(); toggleIndicator(config.id, !config.enabled); }}
      >
        {config.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>

      <button
        type="button"
        title="Delete"
        aria-label="Delete indicator"
        className="shrink-0 p-1 rounded text-destructive opacity-60 group-hover:opacity-100 hover:bg-destructive/10"
        onClick={(e) => { e.stopPropagation(); removeIndicator(config.id); }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function IndicatorManager() {
  const isOpen = useUIStore((s) => s.indicatorManager.isOpen);
  const toggleIndicatorManager = useUIStore((s) => s.toggleIndicatorManager);
  const toggleIndicatorDialog = useUIStore((s) => s.toggleIndicatorDialog);
  const indicators = useChartStore((s) => s.indicators);

  if (!isOpen) return null;

  const rows = Array.from(indicators.collection.values());

  return (
    <div className="w-64 shrink-0 flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground">
          Indicators {rows.length > 0 && <span className="text-muted-foreground font-normal">({rows.length})</span>}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Add indicator" title="Add indicator" onClick={() => toggleIndicatorDialog(true)}>
            <Plus size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close" onClick={() => toggleIndicatorManager(false)}>
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center px-4 py-8">
            No indicators yet. Use <span className="text-foreground">+</span> to add one.
          </p>
        ) : (
          rows.map((config) => <IndicatorRow key={config.id} config={config} />)
        )}
      </div>
    </div>
  );
}
