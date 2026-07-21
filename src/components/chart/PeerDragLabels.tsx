'use client'

import { useEffect, useMemo, useRef } from 'react';
import { Move } from 'lucide-react';
import type { Time } from 'cochart-charts';
import { useCollabStore } from '@/stores/useCollabStore';
import { useChartStore } from '@/stores/useChartStore';
import { timeToCoordinateExtrapolated } from '@/core/chart/interval';
import type { PresenceUser } from '@/stores/types';

/**
 * Renders a name badge in the dragger's color next to any drawing a peer is
 * currently dragging, so everyone can see who is moving what. The badge is
 * re-projected to this viewer's pixels every frame (like PeerCursors), anchored
 * to the drawing's first point, so it tracks the shape as it moves and stays put
 * through pan/zoom.
 */
export default function PeerDragLabels() {
  const draggingPeers = useCollabStore((s) => s.draggingPeers);
  const activeUsers = useCollabStore((s) => s.activeUsers);
  const chartApi = useChartStore((s) => s.chartApi);
  const seriesApi = useChartStore((s) => s.seriesApi);

  // One badge per active drag whose user is in the roster. Recomputes only when
  // the set of dragged drawings or the roster changes.
  const drags = useMemo(() => {
    const byId = new Map(activeUsers.map((u) => [u.userId, u]));
    return Object.entries(draggingPeers)
      .map(([drawingId, userId]) => {
        const user = byId.get(userId);
        return user ? { drawingId, user } : null;
      })
      .filter((d): d is { drawingId: string; user: PresenceUser } => !!d);
  }, [draggingPeers, activeUsers]);

  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (drags.length === 0 || !chartApi || !seriesApi) return;
    let raf = 0;
    const tick = () => {
      const live = useCollabStore.getState().draggingPeers;
      const collection = useChartStore.getState().drawings.collection;
      for (const [drawingId, node] of nodeRefs.current) {
        const drawing = live[drawingId] ? collection.get(drawingId) : undefined;
        const anchor = drawing?.points[0];
        const x = anchor ? timeToCoordinateExtrapolated(chartApi, seriesApi, anchor.time as Time) : null;
        const y = anchor ? seriesApi.priceToCoordinate(anchor.price) : null;
        if (x === null || y === null || x === undefined || y === undefined) {
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
  }, [drags, chartApi, seriesApi]);

  if (drags.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
      {drags.map(({ drawingId, user }) => (
        <div
          key={drawingId}
          ref={(el) => {
            if (el) nodeRefs.current.set(drawingId, el);
            else nodeRefs.current.delete(drawingId);
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ display: 'none' }}
        >
          <span
            className="absolute left-2 top-2 flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
            style={{ backgroundColor: user.color }}
          >
            <Move size={11} />
            {user.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}
