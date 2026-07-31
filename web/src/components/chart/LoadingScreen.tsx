import { CandlestickChart } from 'lucide-react';

/**
 * Full-screen branded loading state shown while the chart client boots. Matches
 * the app's dark theme and `live` accent so it reads as CoChart rather than a
 * bare "Loading…" flash.
 */
export default function LoadingScreen({ message = 'Loading chart…' }: { message?: string }) {
	return (
		<div className="flex h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
			<div className="flex items-center gap-3">
				<CandlestickChart className="text-live" size={32} strokeWidth={2.25} />
				<span className="text-2xl font-bold tracking-tight">
					Co<span className="text-live">Chart</span>
				</span>
			</div>

			<div className="flex items-center gap-3 text-sm text-muted-foreground">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-live border-t-transparent" />
				<span>{message}</span>
			</div>
		</div>
	);
}
