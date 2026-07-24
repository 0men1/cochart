'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useCollabStore } from '@/stores/useCollabStore';

// Shown when the server refuses a room join because the user is already in
// another room. Lets them choose: leave the old room and join this one, or
// cancel and stay out.
export default function RoomLimitModal() {
	const roomLimitPrompt = useCollabStore((s) => s.roomLimitPrompt);
	const confirmRoomSwitch = useCollabStore((s) => s.confirmRoomSwitch);
	const dismissRoomLimit = useCollabStore((s) => s.dismissRoomLimit);

	if (!roomLimitPrompt) return null;

	const onCancel = () => {
		dismissRoomLimit();
		// They chose not to join, so leave the room URL behind.
		window.history.pushState({}, '', '/chart');
	};

	return (
		<Modal open onClose={onCancel} dismissOnBackdrop={false} aria-label="Already in a room">
			<div className="flex flex-col gap-4 p-6">
				<div className="flex flex-col gap-1">
					<h2 className="text-base font-semibold text-foreground">
						You&apos;re already in a room
					</h2>
					<p className="text-sm text-muted-foreground">
						You can only have one room open at a time. Leave your current room and
						join this one instead?
					</p>
				</div>
				<div className="flex justify-end gap-2">
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={confirmRoomSwitch}>Leave &amp; join</Button>
				</div>
			</div>
		</Modal>
	);
}
