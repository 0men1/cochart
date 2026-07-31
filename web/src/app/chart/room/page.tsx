'use client'

import ClientChart from "@/components/chart/ClientChart";
import { useCollabStore } from "@/stores/useCollabStore";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Room id travels as a query param (`/chart/room?id=<roomId>`) rather than a
// path segment so the page is a single static route under `output: 'export'`
// (a dynamic `[roomId]` segment can't be prerendered without params).
function ChartCollabRoom() {
  const roomId = useSearchParams().get("id");

  const { connectSocket } = useCollabStore();

  useEffect(() => {
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

export default function ChartCollabRoomPage() {
  // useSearchParams() must be read under a Suspense boundary (required by
  // Next, and enforced by static export).
  return (
    <Suspense>
      <ChartCollabRoom />
    </Suspense>
  );
}
