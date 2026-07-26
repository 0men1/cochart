'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Settings, Copy, Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';

const VIEWPORT_PAD = 8;

// Right-click menu for a single drawing
export default function DrawingContextMenu() {
  const menu = useUIStore((s) => s.drawingContextMenu);
  const close = useUIStore((s) => s.closeDrawingContextMenu);
  const openDrawingSettings = useUIStore((s) => s.openDrawingSettings);
  const drawings = useChartStore((s) => s.drawings);
  const deleteDrawing = useChartStore((s) => s.deleteDrawing);
  const duplicateDrawing = useChartStore((s) => s.duplicateDrawing);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const drawing = menu.drawingId ? drawings.collection.get(menu.drawingId) : null;

  // Keep the menu fully on-screen once its size is known.
  useLayoutEffect(() => {
    if (!menu.isOpen || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let x = menu.x;
    let y = menu.y;
    if (x + rect.width + VIEWPORT_PAD > window.innerWidth) x = window.innerWidth - rect.width - VIEWPORT_PAD;
    if (y + rect.height + VIEWPORT_PAD > window.innerHeight) y = window.innerHeight - rect.height - VIEWPORT_PAD;
    setPos({ x: Math.max(VIEWPORT_PAD, x), y: Math.max(VIEWPORT_PAD, y) });
  }, [menu.isOpen, menu.x, menu.y]);

  // Dismiss on outside click, Escape, scroll, or resize.
  useEffect(() => {
    if (!menu.isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onScrollOrResize = () => close();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menu.isOpen, close]);

  if (!menu.isOpen || !drawing || !menu.drawingId) return null;
  const id = menu.drawingId;

  const Item = ({ icon: Icon, label, onSelect, danger }: {
    icon: typeof Settings; label: string; onSelect: () => void; danger?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => { onSelect(); close(); }}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${danger
        ? 'text-destructive hover:bg-destructive/10'
        : 'text-foreground hover:bg-accent'}`}
    >
      <Icon size={15} className="shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 60 }}
      className="min-w-44 rounded-md border border-border bg-card py-1 text-sm shadow-lg"
    >
      <Item icon={Settings} label="Settings" onSelect={() => openDrawingSettings(id)} />
      <Item icon={Copy} label="Duplicate" onSelect={() => duplicateDrawing(id)} />
      <Item
        icon={drawing.isVisible ? EyeOff : Eye}
        label={drawing.isVisible ? 'Hide' : 'Show'}
        onSelect={() => drawing.setVisible(!drawing.isVisible)}
      />
      <Item
        icon={drawing.isLocked ? LockOpen : Lock}
        label={drawing.isLocked ? 'Unlock' : 'Lock'}
        onSelect={() => drawing.setLocked(!drawing.isLocked)}
      />
      <div className="my-1 border-t border-border" />
      <Item icon={Trash2} label="Delete" danger onSelect={() => deleteDrawing(id)} />
    </div>
  );
}
