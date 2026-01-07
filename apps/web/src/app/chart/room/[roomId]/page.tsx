'use client'

import ClientChart from "@/components/chart/ClientChart";
import { useCollabStore } from "@/stores/useCollabStore";
import { use, useEffect } from "react";

export default function ChartCollabRoom({ params }: { params: Promise<{ roomId: string }> }) {
	const { roomId } = use(params);

	const { connectSocket } = useCollabStore();

	useEffect(() => {
		console.log("roomId", roomId)
		if (roomId) {
			connectSocket(roomId);
		}
	}, [])

	if (!roomId) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-red-500">Error: Missing room ID</div>
			</div>
		);
	}

	return <ClientChart />;
}
