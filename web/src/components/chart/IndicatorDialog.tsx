'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal, ModalClose } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { IndicatorType } from '@/core/chart/indicators/types';
import { INDICATOR_META, INDICATOR_ORDER } from '@/core/chart/indicators/registry';

// Add palette: the indicators equivalent of the drawing ToolBox. Clicking a type
// adds a new instance and leaves the dialog open, so clicking SMA three times
// gives three independent SMAs (managed/edited from the Indicator manager).
export default function IndicatorDialog() {
  const isOpen = useUIStore((s) => s.indicatorDialog.isOpen);
  const toggleIndicatorDialog = useUIStore((s) => s.toggleIndicatorDialog);
  const toggleIndicatorManager = useUIStore((s) => s.toggleIndicatorManager);
  const addIndicator = useChartStore((s) => s.addIndicator);
  const [query, setQuery] = useState('');

  const rows = INDICATOR_ORDER.filter((type) =>
    INDICATOR_META[type].label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const add = (type: IndicatorType) => {
    addIndicator(type);
    // Surface the new instance in the manager so its effect is visible.
    toggleIndicatorManager(true);
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => toggleIndicatorDialog(false)}
      align="top"
      aria-label="Add indicator"
      className="max-w-md overflow-hidden p-0"
    >
      <div className="flex items-center justify-between border-b border-border px-4 h-11">
        <span className="text-sm font-semibold text-foreground">Add indicator</span>
        <ModalClose onClick={() => toggleIndicatorDialog(false)} />
      </div>

      <div className="border-b border-border px-3 py-2">
        <Input
          autoFocus
          placeholder="Search indicators..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8"
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-1.5">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No indicators match.</p>
        ) : (
          rows.map((type) => {
            const meta = INDICATOR_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => add(type)}
                className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <Icon size={18} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{meta.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{meta.description}</div>
                </div>
                <Plus size={16} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
