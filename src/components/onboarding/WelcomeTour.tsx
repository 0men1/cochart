'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Zap,
  PenTool,
  Users,
  SlidersHorizontal,
  Keyboard,
  MousePointerClick,
  LineChart,
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Modal, ModalClose } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { cn } from '@/lib/utils';
import { DRAWING_TYPE_META } from '@/components/chart/drawingMeta';
import { DrawingType } from '@/core/chart/types';
import { INDICATOR_META, INDICATOR_ORDER } from '@/core/chart/indicators/registry';

interface WelcomeTourProps {
  onClose: () => void;
}

interface TourItem {
  icon: LucideIcon;
  label: string;
  hotkey?: string;
}

interface TourShortcut {
  keys: string;
  action: string;
}

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  items?: TourItem[];
  shortcuts?: TourShortcut[];
  footnote?: string;
}

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

const DRAWING_TOOL_ORDER: DrawingType[] = [
  DrawingType.VERTICAL_LINE,
  DrawingType.HORIZONTAL_LINE,
  DrawingType.TREND_LINE,
  DrawingType.RAY,
  DrawingType.RECTANGLE,
  DrawingType.TRIANGLE,
  DrawingType.FIBONACCI,
  DrawingType.TEXT,
];

const INDICATOR_ITEMS: TourItem[] = INDICATOR_ORDER.map((type) => ({
  icon: INDICATOR_META[type].icon,
  label: INDICATOR_META[type].label,
}));

function buildSteps(hotkeys: Record<DrawingType, string>): TourStep[] {
  const drawingItems: TourItem[] = DRAWING_TOOL_ORDER.map((tool) => ({
    icon: DRAWING_TYPE_META[tool].icon,
    label: DRAWING_TYPE_META[tool].label,
    hotkey: hotkeys[tool] || undefined,
  }));

  const boundKeys = DRAWING_TOOL_ORDER.map((t) => hotkeys[t]).filter(Boolean).sort();
  const toolKeyRange =
    boundKeys.length > 1
      ? `${boundKeys[0]}–${boundKeys[boundKeys.length - 1]}`
      : boundKeys[0] ?? '1–8';

  return [
    {
      icon: <TrendingUp className="w-7 h-7 text-foreground" />,
      title: 'Welcome to Cochart',
      description:
        "A real-time, collaborative charting terminal — no signup required. Here's a quick tour of everything you can do.",
    },
    {
      icon: <Zap className="w-7 h-7 text-amber-500" />,
      title: 'Choose your market',
      description:
        'Click the ticker up top — or just start typing — to search any symbol across Coinbase, Binance, and Kraken. Candles stream tick-by-tick and backfill with history; switch timeframes from 1m all the way to 1D.',
    },
    {
      icon: <PenTool className="w-7 h-7 text-emerald-500" />,
      title: 'Drawing tools',
      description: 'Mark up the chart from the toolbar on the left — or tap its number key:',
      items: drawingItems,
      footnote: 'Remap any tool’s key in Settings → Hotkeys.',
    },
    {
      icon: <MousePointerClick className="w-7 h-7 text-emerald-500" />,
      title: 'Edit & organize',
      description:
        'Click any drawing to recolor and restyle it, or drag its control points to reshape it. Open the Drawings panel (the layers icon) to toggle visibility or delete items.',
    },
    {
      icon: <LineChart className="w-7 h-7 text-blue-500" />,
      title: 'Indicators',
      description:
        'Open the Indicators menu (the line-chart icon up top) to overlay studies or add them in their own pane. Stack as many as you like, each with its own params and color:',
      items: INDICATOR_ITEMS,
    },
    {
      icon: <Users className="w-7 h-7 text-blue-500" />,
      title: 'Collaborate live',
      description:
        'Hit Share to spin up a room, then send the link. Pick your name and color, watch everyone’s cursors move in real time, and talk it through in the room chat — every drawing syncs instantly.',
    },
    {
      icon: <Keyboard className="w-7 h-7 text-purple-500" />,
      title: 'Power tips',
      description: 'A few shortcuts to move faster:',
      shortcuts: [
        { keys: toolKeyRange, action: 'Activate a drawing tool' },
        { keys: `${MOD} Z`, action: 'Undo' },
        { keys: `${MOD} ⇧ Z`, action: 'Redo' },
        { keys: 'Delete', action: 'Remove the selected drawing' },
        { keys: 'Esc', action: 'Cancel a tool or deselect' },
        { keys: `Hold ${MOD}`, action: 'Snap to nearby candles (magnet)' },
        { keys: 'A–Z', action: 'Start typing to search tickers' },
      ],
      footnote: 'Tool keys are customizable in Settings → Hotkeys.',
    },
    {
      icon: <SlidersHorizontal className="w-7 h-7 text-purple-500" />,
      title: 'Make it yours',
      description:
        'Open Settings to tune the theme, timezone, grid, crosshair magnet, candle colors, and axis font. Your preferences — and your drawings — are saved right here on this device.',
    },
  ];
}

export default function WelcomeTour({ onClose }: WelcomeTourProps) {
  const isOpen = useUIStore((s) => s.welcomeTour.isOpen);
  const hotkeys = useChartStore((s) => s.chartSettings.hotkeys);
  const steps = useMemo(() => buildSteps(hotkeys), [hotkeys]);
  const [step, setStep] = useState(0);

  // Always start a reopened tour from the beginning.
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const current = steps[step];

  const next = () => {
    if (isLast) onClose();
    else setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      aria-label="Welcome to Cochart"
      className="max-w-[420px] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Cochart Terminal</h2>
          <p className="text-xs text-muted-foreground font-medium">Real-time Collaborative Analysis</p>
        </div>
        <ModalClose onClick={onClose} />
      </div>

      {/* Step body */}
      <div className="px-6 py-8 flex flex-col items-center text-center gap-4 min-h-[220px] max-h-[60vh] overflow-y-auto">
        <div className="p-3 bg-muted rounded-xl border border-border">
          {current.icon}
        </div>
        <h3 className="text-base font-semibold text-foreground">{current.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px]">
          {current.description}
        </p>

        {current.items && (
          <div className="grid grid-cols-2 gap-2 w-full mt-1">
            {current.items.map(({ icon: Icon, label, hotkey }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left"
              >
                <Icon size={16} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 text-xs font-medium text-foreground truncate">{label}</span>
                {hotkey && (
                  <kbd className="shrink-0 rounded border border-border bg-background px-1.5 text-[10px] font-semibold text-muted-foreground">
                    {hotkey}
                  </kbd>
                )}
              </div>
            ))}
          </div>
        )}

        {current.shortcuts && (
          <div className="flex flex-col gap-1.5 w-full mt-1">
            {current.shortcuts.map(({ keys, action }) => (
              <div key={action} className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground text-left">{action}</span>
                <kbd className="shrink-0 rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        )}

        {current.footnote && (
          <p className="text-[11px] text-muted-foreground/80 italic mt-1">{current.footnote}</p>
        )}
      </div>

      {/* Footer: progress dots + navigation */}
      <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-4 bg-primary' : 'w-1.5 bg-border'
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isFirst ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Skip
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
              <ArrowLeft size={14} />
              Back
            </Button>
          )}
          <Button size="sm" onClick={next} className="gap-1.5 min-w-[92px]">
            {isLast ? 'Get started' : (
              <>
                Next
                <ArrowRight size={14} />
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
