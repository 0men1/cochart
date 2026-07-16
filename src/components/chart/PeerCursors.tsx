'use client'

import { useEffect, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { Time } from 'cochart-charts';
import { useCollabStore } from '@/stores/useCollabStore';
import { useChartStore } from '@/stores/useChartStore';
import { timeToCoordinateExtrapolated } from '@/core/chart/interval';
import type { PresenceUser } from '@/stores/types';

/**
 * Renders peers' live cursors as an overlay on top of the chart. Each cursor's
 * stored chart coordinate (time + price) is re-projected to this viewer's pixels
 * every frame, so markers stay anchored to the same candle through pan/zoom.
 *
 * Nodes are positioned imperatively via refs so React only re-renders when the
 * set of visible peers changes, not on every animation frame.
 */
export default function PeerCursors() {
  const peerCursors = useCollabStore((s) => s.peerCursors);
  const activeUsers = useCollabStore((s) => s.activeUsers);
  const chartApi = useChartStore((s) => s.chartApi);
  const seriesApi = useChartStore((s) => s.seriesApi);

  // One node per peer that has both a live cursor and a roster entry (for its
  // name + color). Recomputes only when those sets change.
  const cursors = useMemo(() => {
    const byId = new Map(activeUsers.map((u) => [u.userId, u]));
    return Object.keys(peerCursors)
      .map((id) => byId.get(id))
      .filter((u): u is PresenceUser => !!u);
  }, [peerCursors, activeUsers]);

  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (cursors.length === 0 || !chartApi || !seriesApi) return;
    let raf = 0;
    const tick = () => {
      const live = useCollabStore.getState().peerCursors;
      for (const [userId, node] of nodeRefs.current) {
        const c = live[userId];
        const x = c ? timeToCoordinateExtrapolated(chartApi, seriesApi, c.time as Time) : null;
        const y = c ? seriesApi.priceToCoordinate(c.price) : null;
        if (x === null || y === null) {
          node.style.display = 'none';
        } else {
          node.style.display = '';
          node.style.transform = `translate(${x}px, ${y}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cursors, chartApi, seriesApi]);

  if (cursors.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
      {cursors.map((u) => (
        <div
          key={u.userId}
          ref={(el) => {
            if (el) nodeRefs.current.set(u.userId, el);
            else nodeRefs.current.delete(u.userId);
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ display: 'none' }}
        >
          <Plus
            size={20}
            fill={u.color}
            style={{ color: u.color }}
            className="drop-shadow-sm"
          />
          <span
            className="absolute left-4 top-4 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
            style={{ backgroundColor: u.color }}
          >
            {u.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}
