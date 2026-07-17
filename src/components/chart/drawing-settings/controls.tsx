'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { DrawingOptionKey, DrawingLineStyle, EditableOption } from '@/core/chart/drawings/types';
import { BaseDrawing } from '@/core/chart/drawings/primitives/BaseDrawing';
import { fibLevelColor } from '@/core/chart/drawings/primitives/FibonacciRetracement';

export interface ControlProps {
  option: EditableOption;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  drawing: BaseDrawing;
}

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

function ColorControl({ value, onChange }: ControlProps) {
  return <ColorSwatch value={typeof value === 'string' ? value : '#000000'} onChange={onChange} />;
}

function NumberControl({ option, value, onChange }: ControlProps) {
  return (
    <Input
      type="number"
      value={value === undefined ? '' : Number(value)}
      min={option.min}
      max={option.max}
      step={option.step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className="w-24"
    />
  );
}

function ToggleControl({ value, onChange }: ControlProps) {
  return (
    <Checkbox
      className="size-5"
      checked={value === true}
      onCheckedChange={(c) => onChange(c === true)}
    />
  );
}

const LINE_STYLES: { value: DrawingLineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

function LineStyleControl({ value, onChange }: ControlProps) {
  const current = typeof value === 'string' ? value : 'solid';
  return (
    <Select value={current} onValueChange={(v) => onChange(v)}>
      <SelectTrigger size="sm" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LINE_STYLES.map((s) => (
          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Fibonacci levels editor: each level has an editable value + color, can be
// removed, and new levels can be added. Reads/writes `levels` + `levelColors`
// (kept index-aligned) directly on the drawing.
function LevelsControl({ drawing }: ControlProps) {
  const options = drawing.options;
  const levels = options.levels ?? [];
  // Resolve the currently-displayed color for each level (per-level override,
  // else uniform, else palette) so the swatches match the chart.
  const colors = levels.map((lv, i) => fibLevelColor(options, i, lv));

  const commit = (nextLevels: number[], nextColors: string[]) => {
    drawing.updateOptions({ levels: nextLevels, levelColors: nextColors });
  };

  const setValue = (i: number, v: number) => {
    const next = [...levels];
    next[i] = v;
    commit(next, colors);
  };
  const setColor = (i: number, c: string) => {
    const next = [...colors];
    next[i] = c;
    commit(levels, next);
  };
  const remove = (i: number) => {
    commit(levels.filter((_, idx) => idx !== i), colors.filter((_, idx) => idx !== i));
  };
  const add = () => {
    const value = 0.5;
    commit([...levels, value], [...colors, fibLevelColor(options, levels.length, value)]);
  };

  return (
    <div className="w-full space-y-2">
      {levels.map((level, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            type="number"
            step={0.001}
            value={level}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) setValue(i, n);
            }}
            className="w-24"
          />
          <ColorSwatch value={colors[i]} onChange={(c) => setColor(i, c)} />
          <div className="flex-1" />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => remove(i)}
            title="Remove level"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="gap-1.5" onClick={add}>
        <Plus size={14} />
        Add level
      </Button>
    </div>
  );
}

// Pick the control component from the option's enum key. Shared keys map to the
// same component, so shared options render identically across drawing types.
// Keys without an entry are not renderable.
export const CONTROL_BY_KEY: Partial<Record<DrawingOptionKey, React.FC<ControlProps>>> = {
  [DrawingOptionKey.COLOR]: ColorControl,
  [DrawingOptionKey.FILL_COLOR]: ColorControl,
  [DrawingOptionKey.WIDTH]: NumberControl,
  [DrawingOptionKey.FILL_OPACITY]: NumberControl,
  [DrawingOptionKey.FONT_SIZE]: NumberControl,
  [DrawingOptionKey.SHOW_BORDER]: ToggleControl,
  [DrawingOptionKey.LEVELS]: LevelsControl,
  [DrawingOptionKey.LINE_STYLE]: LineStyleControl,
};
