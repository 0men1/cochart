'use client'

import { useChartStore } from '@/stores/useChartStore';

/**
 * Subtle top-left overlay showing which chart is on screen — ticker, timeframe,
 * and exchange. Kept translucent and muted so it stays out of the way while
 * remaining legible at a glance. Non-interactive (pointer-events-none) so it
 * never intercepts chart gestures.
 */
export default function ChartInfoBanner() {
	const product = useChartStore((s) => s.data.product);
	const timeframe = useChartStore((s) => s.data.timeframe);

	if (!product) return null;

	return (
		<div className="pointer-events-none absolute top-3 left-3 z-10 select-none">
			<div className="flex items-center gap-2 rounded-md border border-border/40 bg-card/60 px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm">
				<span className="font-semibold text-foreground/90">{product.name}</span>
				<span className="h-3 w-px bg-border/60" />
				<span className="text-muted-foreground">{timeframe}</span>
				<span className="h-3 w-px bg-border/60" />
				<span className="uppercase tracking-wide text-muted-foreground/70">{product.exchange}</span>
			</div>
		</div>
	);
}
