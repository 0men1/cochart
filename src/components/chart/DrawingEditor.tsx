'use client'

import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Trash } from 'lucide-react';
import { useChartStore } from '@/stores/useChartStore';
import { DrawingOptionKey } from '@/core/chart/drawings/types';
import { rememberDrawingOptions } from '@/core/chart/drawings/drawingDefaults';
import { DrawingType } from '@/core/chart/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUIStore } from '@/stores/useUIStore';

export const DrawingEditor = () => {
  const [values, setValues] = useState<Record<string, any>>({});
  const editorRef = useRef<HTMLDivElement>(null);
  const { openDrawingSettings } = useUIStore();

  const { deleteDrawing, drawings } = useChartStore();
  const { selected } = drawings

  const selectedDrawing = useMemo(() => {
    if (!selected) return null;
    return drawings.collection.get(selected)
  }, [selected, drawings]);


  const handleDelete = async () => {
    if (!selected) return;
    selectedDrawing?.delete();
    deleteDrawing(selected);
  }
  const handleOpenSettings = async () => {
    if (!selected) return;
    openDrawingSettings(selected)
  }

  useEffect(() => {
    if (selected && selectedDrawing) {
      const initialValues: Record<string, any> = {};
      selectedDrawing?.getEditableOptions().forEach(option => {
        initialValues[option.key] = option.currentValue;
      });
      setValues(initialValues);
    }
  }, [selected, selectedDrawing]);

  if (!selectedDrawing) return null;

  const updateOption = (key: string, value: any) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);
    selectedDrawing?.updateOptions({ [key]: value });
    if (selectedDrawing) {
      rememberDrawingOptions(selectedDrawing.serialize().type as DrawingType, selectedDrawing.options);
    }
  };

  const colorOptions = selectedDrawing?.getEditableOptions().filter(o => o.type === 'color');
  const numberOptions = selectedDrawing?.getEditableOptions().filter(o => o.key === DrawingOptionKey.WIDTH);
  const lineStyleOption = selectedDrawing?.getEditableOptions().find(o => o.type === 'lineStyle');

  const primaryColorOptions = colorOptions?.filter(
    o => o.key !== DrawingOptionKey.LABEL_TEXT_COLOR && o.key !== DrawingOptionKey.LABEL_BACKGROUND_COLOR
  );


  return (
    <div ref={editorRef} className="bg-card border border-border rounded-lg shadow-lg">
      <div className="p-2 flex items-center space-x-2">
        {primaryColorOptions?.map(option => (
          <Input
            key={option.key}
            type="color"
            value={values[option.key] || '#000000'}
            onChange={(e) => updateOption(option.key, e.target.value)}
            className="w-8 h-8 p-0 rounded-full cursor-pointer"
            title={option.label}
          />
        ))}

        {numberOptions?.map(option => (
          <div key={option.key} className="flex items-center space-x-1">
            {[1, 2, 3, 4].map(w => (
              <Button
                key={w}
                size="sm"
                variant={(values[option.key] ?? 2) === w ? "default" : "ghost"}
                className="w-7 h-8 p-0"
                onClick={() => updateOption(option.key, w)}
                title={`Thickness ${w}`}
              >
                {w}
              </Button>
            ))}
          </div>
        ))}

        {lineStyleOption && (
          <Select
            value={(values.lineStyle as string) ?? 'solid'}
            onValueChange={(v) => updateOption(lineStyleOption.key, v)}
          >
            <SelectTrigger size="sm" className="h-8 w-28" title="Line Style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="flex-1"></div>
        <Button
          size="sm"
          variant="ghost"
          className="w-8 h-8 p-0"
          onClick={handleOpenSettings}
          title="Open Settings"
        >
          <Settings size={16} />
        </Button>

        <div className="flex-1"></div>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 w-8 h-8 p-0"
          onClick={handleDelete}
          title="Delete Drawing"
        >
          <Trash size={16} />
        </Button>
      </div >
    </div >
  );
};
