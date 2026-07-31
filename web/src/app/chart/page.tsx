'use client'

import ClientChart from "@/components/chart/ClientChart";
import LoadingScreen from "@/components/chart/LoadingScreen";
import { useEffect, useState } from "react";


export default function SoloChart() {
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		setIsLoaded(true);
	}, []);

	if (!isLoaded) {
		return <LoadingScreen />;
	}

	return (
		<ClientChart />
	)
}
