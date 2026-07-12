'use client'

import { useState } from "react";
import { Check, Copy, Loader2, LogOut, Users } from "lucide-react";
import { useCollabSession } from "./hooks/useCollabSession";
import { useCollabStore } from "@/stores/useCollabStore";
import { Button } from "../ui/button";
import { Modal, ModalClose } from "../ui/modal";

export default function CollabStatus() {
	const session = useCollabSession();
	const { isOpen, roomId } = useCollabStore();
	const [copied, setCopied] = useState(false);

	if (!isOpen) return null;

	const inviteUrl = roomId ? `${window.location.origin}/chart/room/${roomId}` : "";
	const isConnected = !!roomId;

	async function handleCopyUrl() {
		if (!inviteUrl) return;
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Modal open onClose={session.closeWindow} aria-label="Live collaboration" className="p-6">
			{/* Header */}
			<div className="text-center mb-8 relative">
				<ModalClose onClick={session.closeWindow} className="absolute right-0 top-0" />

				<h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
					Live Collaboration
				</h2>

				{isConnected ? (
					<div className="flex items-center justify-center gap-2 text-live text-sm font-medium">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
						</span>
						<span>Session Active</span>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						Create a room to trade with others in real-time.
					</p>
				)}
			</div>

			{/* Content */}
			{isConnected ? (
				<div className="space-y-6">
					<div className="space-y-2">
						<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Invite Link
						</label>
						<div className="flex gap-2">
							<div className="flex-1 p-3 rounded-md bg-muted border border-border font-mono text-xs text-foreground truncate">
								{inviteUrl}
							</div>
							<Button
								onClick={handleCopyUrl}
								className="bg-live text-live-foreground hover:bg-live/90 min-w-[3rem]"
								title="Copy invite link"
							>
								{copied ? <Check size={16} /> : <Copy size={16} />}
							</Button>
						</div>
					</div>

					<Button
						variant="ghost"
						onClick={session.leaveSession}
						className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
					>
						<LogOut size={16} />
						End Session
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					<Button
						disabled={session.isCreating}
						className="w-full h-12 gap-2"
						onClick={session.createSession}
					>
						{session.isCreating ? (
							<>
								<Loader2 className="animate-spin" size={18} />
								Creating Room...
							</>
						) : (
							<>
								<Users size={18} />
								Create New Room
							</>
						)}
					</Button>

					{session.error && (
						<p className="text-destructive text-xs text-center font-medium">
							{session.error}
						</p>
					)}
				</div>
			)}
		</Modal>
	);
}
