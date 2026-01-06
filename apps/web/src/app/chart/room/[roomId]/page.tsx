'use client'

import ClientChart from "@/components/chart/ClientChart";

export default function ChartCollabRoom({
	params
}: {
	params: Promise<{ roomId: string }>
}) {
	return <ClientChart />;
}

