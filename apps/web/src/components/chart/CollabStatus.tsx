'use client'

import { Loader2, LogOut, Users, X } from "lucide-react";
import { useCollabSession } from "./hooks/useCollabSession";
import { useCollabStore } from "@/stores/useCollabStore";

export default function CollabStatus() {
	const session = useCollabSession();

	const { isOpen, roomId } = useCollabStore();

	if (!isOpen) return null;

	async function handleCopyUrl() {
		await navigator.clipboard.writeText(`${window.location.origin}/chart/room/${roomId}`);
	}

	const isConnected = !!roomId;

	return (
		<div
			className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
			onClick={session.closeWindow}
		>
			<div
				className={`border rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 transition-all duration-300 ${isConnected
					? 'bg-zinc-900 border-emerald-500/30 ring-1 ring-emerald-500/20'
					: 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
					}`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="text-center mb-8 relative">
					<button
						onClick={session.closeWindow}
						className="absolute right-0 top-0 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
					>
						<X size={18} className="text-zinc-500" />
					</button>

					<h2 className={`text-2xl font-bold tracking-tight mb-2 ${isConnected ? 'text-emerald-400' : 'text-zinc-900 dark:text-white'
						}`}>
						Live Collaboration
					</h2>

					{isConnected ? (
						<div className="flex items-center justify-center gap-2 text-emerald-400/80 text-sm font-medium">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
							</span>
							<span>Session Active</span>
						</div>
					) : (
						<p className="text-zinc-500 dark:text-zinc-400 text-sm">
							Create a room to trade with others in real-time.
						</p>
					)}
				</div>

				{/* Content */}
				{isConnected ? (
					<div className="space-y-6">
						<div className="space-y-2">
							<label className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider">
								Invite Link
							</label>
							<div className="flex gap-2">
								<div className="flex-1 p-3 rounded-lg bg-zinc-950 border border-emerald-500/20 font-mono text-xs text-emerald-100 truncate">
									{`${window.location.origin}/chart/room/${roomId}`}
								</div>
								<button
									className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center justify-center min-w-[3rem]"
									onClick={handleCopyUrl}
									title="Copy URL" > </button>
							</div>
						</div>

						<div className="pt-2">
							<button
								className="w-full inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 h-10 px-6 gap-2"
								onClick={session.leaveSession}
							>
								<LogOut size={16} />
								End Session
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<button
							disabled={session.isCreating}
							className="w-full inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 h-12 gap-2 shadow-sm disabled:opacity-50"
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
						</button>

						{session.error && (
							<p className="text-red-500 text-xs text-center font-medium">
								{session.error}
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
