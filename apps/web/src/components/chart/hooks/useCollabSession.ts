'use client'

import { useCollabStore } from "@/stores/useCollabStore";
import { useState } from "react";

export function useCollabSession() {
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { setRoom, toggleCollabWindow, connectSocket, disconnectSocket } = useCollabStore();

	const createSession = async () => {
		setIsCreating(true);
		setError(null);

		try {
			const response = await fetch('/api/rooms/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) throw new Error("Failed to create session");
			const result = await response.json();

			setRoom(result.roomId, true);
			connectSocket(result.roomId);
			toggleCollabWindow(false);
			window.history.pushState({}, '', result.url);
		} catch (error) {
			console.error("error: failed to create session, ", error);
			setError(error as string);
		} finally {
			setIsCreating(false);
		}
	};

	const leaveSession = () => {
		disconnectSocket();
		toggleCollabWindow(false);
		window.history.pushState({}, '', '/chart');
	};

	return {
		isCreating,
		createSession,
		leaveSession,
		openWindow: () => toggleCollabWindow(true),
		closeWindow: () => toggleCollabWindow(false),
		error
	}
}
