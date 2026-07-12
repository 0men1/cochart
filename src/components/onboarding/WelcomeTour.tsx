'use client';

import { useEffect, useState } from 'react';
import {
	TrendingUp,
	Zap,
	PenTool,
	Users,
	SlidersHorizontal,
	ArrowLeft,
	ArrowRight,
} from 'lucide-react';
import { Modal, ModalClose } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

interface WelcomeTourProps {
	onClose: () => void;
}

interface TourStep {
	icon: React.ReactNode;
	title: string;
	description: string;
}

const STEPS: TourStep[] = [
	{
		icon: <TrendingUp className="w-7 h-7 text-foreground" />,
		title: 'Welcome to Cochart',
		description:
			"A real-time, collaborative charting terminal — no signup required. Here's a quick tour of what you can do.",
	},
	{
		icon: <Zap className="w-7 h-7 text-amber-500" />,
		title: 'Live market data',
		description:
			'Tick-by-tick price feeds stream straight from the exchange. Search any ticker up top and switch timeframes from 1m all the way to 1D.',
	},
	{
		icon: <PenTool className="w-7 h-7 text-emerald-500" />,
		title: 'Drawing tools',
		description:
			'Mark up the chart from the left toolbar: trendlines, rays, Fibonacci retracements, rectangles, and horizontal or vertical lines.',
	},
	{
		icon: <Users className="w-7 h-7 text-blue-500" />,
		title: 'Live collaboration',
		description:
			'Create a room and share the link to analyze together. Pick your name and color, and every drawing and participant syncs in real time.',
	},
	{
		icon: <SlidersHorizontal className="w-7 h-7 text-purple-500" />,
		title: 'Make it yours',
		description:
			'Open Settings to tune the theme, timezone, and grid, crosshair, and candle colors. Your preferences are saved on this device.',
	},
];

export default function WelcomeTour({ onClose }: WelcomeTourProps) {
	const isOpen = useUIStore((s) => s.welcomeTour.isOpen);
	const [step, setStep] = useState(0);

	// Always start a reopened tour from the beginning.
	useEffect(() => {
		if (isOpen) setStep(0);
	}, [isOpen]);

	const isFirst = step === 0;
	const isLast = step === STEPS.length - 1;
	const current = STEPS[step];

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
			<div className="px-6 py-8 flex flex-col items-center text-center gap-4 min-h-[220px]">
				<div className="p-3 bg-muted rounded-xl border border-border">
					{current.icon}
				</div>
				<h3 className="text-base font-semibold text-foreground">{current.title}</h3>
				<p className="text-sm text-muted-foreground leading-relaxed max-w-[320px]">
					{current.description}
				</p>
			</div>

			{/* Footer: progress dots + navigation */}
			<div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
				<div className="flex items-center gap-1.5" aria-hidden>
					{STEPS.map((_, i) => (
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
