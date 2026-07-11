'use client'

import ClientChart from "@/components/chart/ClientChart";
import { useEffect, useState } from "react";


export default function SoloChart() {
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		setIsLoaded(true);
	}, []);

	if (!isLoaded) {
		return <div>Loading...</div>;
	}

	return (
		<ClientChart />
	)
}
