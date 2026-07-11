'use client';

import {
	Zap,
	Users,
	TrendingUp,
	Crosshair,
	Globe,
} from 'lucide-react';
import { Modal, ModalClose } from '@/components/ui/modal';
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

	const handleClose = () => {
		if (onClose) onClose();
	};

	return (
		<Modal
			open={featureSpotlight.isOpen}
			onClose={handleClose}
			aria-label="Welcome to Cochart"
			className="max-w-[400px] flex flex-col overflow-hidden"
		>
			{/* Header */}
			<div className="p-6 border-b border-border flex justify-between items-start bg-muted/30">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<TrendingUp className="w-5 h-5 text-foreground" />
						<h2 className="text-lg font-bold text-foreground tracking-tight">Cochart Terminal</h2>
					</div>
					<p className="text-xs text-muted-foreground font-medium">Real-time Collaborative Analysis</p>
				</div>
				<ModalClose onClick={handleClose} />
			</div>

			{/* Feature List */}
			<div className="p-6 space-y-6">
				{features.map((feature, idx) => (
					<div key={idx} className="flex gap-4 group">
						<div className="mt-0.5">
							<div className="p-2 bg-muted rounded-lg border border-border group-hover:border-ring transition-colors">
								{feature.icon}
							</div>
						</div>
						<div className="space-y-1">
							<h3 className="text-sm font-semibold text-foreground">
								{feature.title}
							</h3>
							<p className="text-xs text-muted-foreground leading-relaxed font-medium">
								{feature.description}
							</p>
						</div>
					</div>
				))}
			</div>

			{/* Footer / CTA Area */}
			<div className="p-4 bg-muted/30 border-t border-border mt-auto">
				<button
					onClick={handleClose}
					className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-md transition-all"
				>
					Enter Workspace
				</button>
			</div>
		</Modal>
	);
};

export default FeatureSpotlight;
