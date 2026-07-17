'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalClose } from '../ui/modal';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { DrawingType } from '@/core/chart/types';
import { EditableOption } from '@/core/chart/drawings/types';
import { CONTROL_BY_KEY } from './drawing-settings/controls';

const TYPE_LABELS: Record<string, string> = {
  [DrawingType.TREND_LINE]: 'Trend Line',
  [DrawingType.RAY]: 'Ray',
  [DrawingType.RECTANGLE]: 'Rectangle',
  [DrawingType.FIBONACCI]: 'Fibonacci Retracement',
  [DrawingType.HORIZONTAL_LINE]: 'Horizontal Line',
  [DrawingType.VERTICAL_LINE]: 'Vertical Line',
};

type OptionValue = string | number | boolean | undefined;

// Cluster options by their `group`, preserving first-seen order.
function groupOptions(options: EditableOption[]): { name: string; options: EditableOption[] }[] {
  const groups: { name: string; options: EditableOption[] }[] = [];
  for (const option of options) {
    const name = option.group ?? '';
    let bucket = groups.find((g) => g.name === name);
    if (!bucket) {
      bucket = { name, options: [] };
      groups.push(bucket);
    }
    bucket.options.push(option);
  }
  return groups;
}

/**
 * Larger, dedicated settings page for a single drawing, opened by double-clicking
 * it. The body is rendered generically from the drawing's `getEditableOptions()`
 * schema: each option's enum key selects a reusable control (see CONTROL_BY_KEY),
 * and edits are written straight back through `updateOptions()`.
 */
export default function DrawingSettings() {
  const { isOpen, drawingId } = useUIStore((s) => s.drawingSettings);
  const closeDrawingSettings = useUIStore((s) => s.closeDrawingSettings);

  // Subscribe to the collection (and updatedAt) so the page reacts to edits and
  // closes itself if the target drawing is deleted while open.
  const drawings = useChartStore((s) => s.drawings);
  const drawing = drawingId ? drawings.collection.get(drawingId) : null;

  const [values, setValues] = useState<Record<string, OptionValue>>({});

  // Seed the form from the drawing's current options whenever the target changes.
  useEffect(() => {
    if (!drawingId) return;
    const target = useChartStore.getState().drawings.collection.get(drawingId);
    if (!target) return;
    const seeded: Record<string, OptionValue> = {};
    for (const option of target.getEditableOptions()) seeded[option.key] = option.currentValue;
    setValues(seeded);
  }, [drawingId]);

  if (!isOpen || !drawing) return null;

  const type = drawing.serialize().type;
  const typeLabel = TYPE_LABELS[type] ?? type;
  const groups = groupOptions(drawing.getEditableOptions());

  const updateOption = (key: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    drawing.updateOptions({ [key]: value });
  };

  return (
    <Modal
      open
      onClose={closeDrawingSettings}
      aria-label="Drawing settings"
      className="max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Drawing settings</h2>
          <p className="text-sm text-muted-foreground">{typeLabel}</p>
        </div>
        <ModalClose onClick={closeDrawingSettings} />
      </div>

      {/* Body — schema-driven controls */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
        {groups.map((group) => (
          <div key={group.name || 'general'} className="space-y-1">
            {group.name && (
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.name}
              </h3>
            )}
            {group.options.map((option) => {
              const Control = CONTROL_BY_KEY[option.key];
              if (!Control) return null;
              const control = (
                <Control
                  option={option}
                  value={values[option.key]}
                  onChange={(v) => updateOption(option.key, v)}
                  drawing={drawing}
                />
              );
              // Wide controls (e.g. the fib levels editor) stack under their label.
              if (option.type === 'levels') {
                return (
                  <div key={option.key} className="py-2 space-y-2">
                    <Label className="text-sm font-medium text-foreground">{option.label}</Label>
                    {control}
                  </div>
                );
              }
              return (
                <div key={option.key} className="flex items-center justify-between py-2">
                  <Label className="text-sm font-medium text-foreground">{option.label}</Label>
                  {control}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
        <Button onClick={closeDrawingSettings} className="min-w-[80px]">
          Done
        </Button>
      </div>
    </Modal>
  );
}
