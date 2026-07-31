'use client'

import { Users } from 'lucide-react';
import { useCollabStore } from '@/stores/useCollabStore';
import { useIdentityStore } from '@/stores/useIdentityStore';

/**
 * Bottom-right roster of everyone in the room: live user count plus each
 * participant's color and name. Only rendered while connected to a room.
 */
export default function PresenceStack() {
	const roomId = useCollabStore((s) => s.roomId);
	const activeUsers = useCollabStore((s) => s.activeUsers);
	const myId = useIdentityStore((s) => s.identity?.userId);

	if (!roomId || activeUsers.length === 0) return null;

	return (
		<div className="w-52 rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">
				<Users size={14} className="text-live" />
				<span>{activeUsers.length} in room</span>
			</div>
			<ul className="py-1 max-h-48 overflow-y-auto custom-scrollbar">
				{activeUsers.map((user) => (
					<li
						key={user.userId}
						className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-foreground"
					>
						<span
							className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
							style={{ backgroundColor: user.color }}
							aria-hidden
						>
							{user.displayName.charAt(0).toUpperCase()}
						</span>
						<span className="truncate">
							{user.displayName}
							{user.userId === myId && (
								<span className="text-muted-foreground"> (you)</span>
							)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
