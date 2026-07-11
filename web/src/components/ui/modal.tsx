'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalAlign = 'center' | 'top';

interface ModalProps {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
	/** Vertical placement of the card. Command-palette style surfaces use "top". */
	align?: ModalAlign;
	/** Hide the default backdrop dismiss (e.g. blocking dialogs). */
	dismissOnBackdrop?: boolean;
	/** Label for screen readers / Escape affordance. */
	'aria-label'?: string;
}

/**
 * Lightweight, token-styled modal shell shared across the app.
 * Handles Escape + backdrop dismissal and a consistent, minimal backdrop so
 * overlays stop competing with heavy full-screen `bg-black/80` treatments.
 */
export function Modal({
	open,
	onClose,
	children,
	className,
	align = 'center',
	dismissOnBackdrop = true,
	...rest
}: ModalProps) {
	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={rest['aria-label']}
			className={cn(
				'fixed inset-0 z-50 flex justify-center px-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-150',
				align === 'center' ? 'items-center' : 'items-start pt-16 md:pt-[18vh]'
			)}
			onClick={dismissOnBackdrop ? onClose : undefined}
		>
			<div
				className={cn(
					'relative z-10 w-full max-w-md rounded-lg border border-border bg-card text-card-foreground shadow-lg animate-in fade-in zoom-in-95 duration-150',
					className
				)}
				onClick={(e) => e.stopPropagation()}
			>
				{children}
			</div>
		</div>
	);
}

/** Optional close button that matches the shared chrome. */
export function ModalClose({ onClick, className }: { onClick: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Close"
			className={cn(
				'inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
				className
			)}
		>
			<X size={18} />
		</button>
	);
}
