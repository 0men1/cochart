'use client';

import { Modal, ModalClose } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { INDICATOR_META, indicatorLabel } from '@/core/chart/indicators/registry';

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-muted-foreground uppercase">{value}</span>
      <div className="relative group">
        <div
          className="w-8 h-8 rounded-full border border-border shadow-sm cursor-pointer transition-transform group-hover:scale-105"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// Per-instance settings page, opened by clicking an indicator in the manager.
// Renders numeric params from the type's schema plus a color picker, writing
// edits straight back to the store (which the reconcile hook applies live).
export default function IndicatorSettings() {
  const { isOpen, indicatorId } = useUIStore((s) => s.indicatorSettings);
  const closeIndicatorSettings = useUIStore((s) => s.closeIndicatorSettings);

  // Subscribe to the collection so the page reacts to edits and closes itself if
  // the target indicator is deleted while open.
  const indicators = useChartStore((s) => s.indicators);
  const updateIndicatorParams = useChartStore((s) => s.updateIndicatorParams);
  const updateIndicatorStyle = useChartStore((s) => s.updateIndicatorStyle);

  const config = indicatorId ? indicators.collection.get(indicatorId) : null;
  if (!isOpen || !config) return null;

  const meta = INDICATOR_META[config.type];

  return (
    <Modal
      open
      onClose={closeIndicatorSettings}
      aria-label="Indicator settings"
      className="max-w-md overflow-hidden flex flex-col"
    >
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Indicator settings</h2>
          <p className="text-sm text-muted-foreground">{indicatorLabel(config)} · {meta.label}</p>
        </div>
        <ModalClose onClick={closeIndicatorSettings} />
      </div>

      <div className="p-6 space-y-1">
        {meta.paramSchema.map((field) => (
          <div key={field.key} className="flex items-center justify-between py-2">
            <Label className="text-sm font-medium text-foreground">{field.label}</Label>
            <Input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={config.params[field.key] ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                const clamped = Math.min(field.max, Math.max(field.min, Math.round(n)));
                updateIndicatorParams(config.id, { [field.key]: clamped });
              }}
              className="w-24"
            />
          </div>
        ))}

        {meta.supportsColor && (
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm font-medium text-foreground">Color</Label>
            <ColorSwatch
              value={config.style.color}
              onChange={(color) => updateIndicatorStyle(config.id, { color })}
            />
          </div>
        )}

        {meta.paramSchema.length === 0 && !meta.supportsColor && (
          <p className="py-4 text-center text-sm text-muted-foreground">No options for this indicator.</p>
        )}
      </div>

      <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
        <Button onClick={closeIndicatorSettings} className="min-w-[80px]">Done</Button>
      </div>
    </Modal>
  );
}
