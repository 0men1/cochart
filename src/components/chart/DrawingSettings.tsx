'use client';

import { Modal, ModalClose } from '../ui/modal';
import { Button } from '../ui/button';
import { useUIStore } from '@/stores/useUIStore';
import { useChartStore } from '@/stores/useChartStore';
import { DrawingType } from '@/core/chart/types';

// Friendly labels for the settings header. Falls back to the raw type string
// for any drawing type not listed here.
const TYPE_LABELS: Record<string, string> = {
	[DrawingType.TREND_LINE]: 'Trend Line',
	[DrawingType.RAY]: 'Ray',
	[DrawingType.RECTANGLE]: 'Rectangle',
	[DrawingType.FIBONACCI]: 'Fibonacci Retracement',
	[DrawingType.HORIZONTAL_LINE]: 'Horizontal Line',
	[DrawingType.VERTICAL_LINE]: 'Vertical Line',
};

/**
 * Larger, dedicated settings page for a single drawing, opened by double-clicking
 * it on the chart. This is the scaffold — per-drawing option controls (built on
 * the drawing's `getEditableOptions()` / `updateOptions()`) will live in the body.
 */
export default function DrawingSettings() {
	const { isOpen, drawingId } = useUIStore((s) => s.drawingSettings);
	const closeDrawingSettings = useUIStore((s) => s.closeDrawingSettings);

	// Subscribe to the collection (and updatedAt) so the page reacts to edits and
	// closes itself if the target drawing is deleted while open.
	const drawings = useChartStore((s) => s.drawings);
	const drawing = drawingId ? drawings.collection.get(drawingId) : null;

	if (!isOpen || !drawing) return null;

	const type = drawing.serialize().type;
	const typeLabel = TYPE_LABELS[type] ?? type;

	return (
		<Modal
			open
			onClose={closeDrawingSettings}
			aria-label="Drawing settings"
			className="max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
		>
			{/* Header */}
			<div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
				<div>
					<h2 className="text-lg font-semibold tracking-tight text-foreground">Drawing settings</h2>
					<p className="text-sm text-muted-foreground">{typeLabel}</p>
				</div>
				<ModalClose onClick={closeDrawingSettings} />
			</div>

			{/* Body — scaffold; per-drawing option controls will be added here. */}
			<div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
				<div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border">
					<p className="text-sm text-muted-foreground">
						Options for this drawing will appear here.
					</p>
				</div>
			</div>

			{/* Footer */}
			<div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
				<Button onClick={closeDrawingSettings} className="min-w-[80px]">
					Done
				</Button>
			</div>
		</Modal>
	);
}
