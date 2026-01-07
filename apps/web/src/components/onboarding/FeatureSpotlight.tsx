'use client';

import { useEffect } from 'react';
import {
	Zap,
	Users,
	TrendingUp,
	Crosshair,
	Globe,
	X
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';

interface FeatureSpotlightProps {
	onClose?: () => void;
}

const FeatureSpotlight = ({ onClose }: FeatureSpotlightProps) => {
	const { featureSpotlight } = useUIStore();

	const features = [
		{
			title: "Live Tick-Level Feeds",
			icon: <Zap className="w-5 h-5 text-amber-500" />,
			description: "Direct WebSocket connections to major exchanges (e.g., Coinbase) deliver institutional-grade, tick-by-tick price updates for assets like SOL/USD with zero latency.",
		},
		{
			title: "Multiplayer Collaboration",
			icon: <Users className="w-5 h-5 text-blue-500" />,
			description: "A synchronized 'War Room' environment. Host a session, share a Room ID, and analyze markets with peers in real-time. Cursor movements and drawings sync instantly across all connected clients.",
		},
		{
			title: "Precision Technical Analysis",
			icon: <Crosshair className="w-5 h-5 text-emerald-500" />,
			description: "Full suite of drawing primitives (Trendlines, Retracements) layered over high-performance Lightweight Charts. Toggle timeframes from 1m to daily intervals.",
		},
		{
			title: "Global Synchronization",
			icon: <Globe className="w-5 h-5 text-purple-500" />,
			description: "State persistence ensures your chart configuration, drawing collections, and timezone settings are preserved or broadcasted perfectly to guest users.",
		}
	];

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			switch (e.key) {
				case "Escape":
					if (onClose) onClose();
					break;
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, []);

	if (!featureSpotlight.isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">

			{/* Card: Vertical rectangle, centered */}
			<div className="w-full max-w-[400px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">

				{/* Header */}
				<div className="p-6 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<TrendingUp className="w-5 h-5 text-zinc-100" />
							<h2 className="text-lg font-bold text-zinc-100 tracking-tight">Cochart Terminal</h2>
						</div>
						<p className="text-xs text-zinc-400 font-medium">Real-time Collaborative Analysis</p>
					</div>
					<button
						onClick={onClose}
						className="text-zinc-500 hover:text-zinc-100 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Feature List */}
				<div className="p-6 space-y-6">
					{features.map((feature, idx) => (
						<div key={idx} className="flex gap-4 group">
							<div className="mt-0.5">
								<div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 group-hover:border-zinc-700 transition-colors">
									{feature.icon}
								</div>
							</div>
							<div className="space-y-1">
								<h3 className="text-sm font-semibold text-zinc-200">
									{feature.title}
								</h3>
								<p className="text-xs text-zinc-500 leading-relaxed font-medium">
									{feature.description}
								</p>
							</div>
						</div>
					))}
				</div>

				{/* Footer / CTA Area */}
				<div className="p-4 bg-zinc-900/30 border-t border-zinc-800 mt-auto">
					<button
						onClick={onClose}
						className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-bold rounded-md transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
					>
						Enter Workspace
					</button>
				</div>
			</div>
		</div>
	);
};

export default FeatureSpotlight;
