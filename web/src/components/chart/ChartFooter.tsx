"use client"

import { useChartStore } from "@/stores/useChartStore";
import { useUIStore } from "@/stores/useUIStore";

const TIMEZONES = [
	{ label: "UTC", value: "UTC" },
	{ label: "New York (EST)", value: "America/New_York" },
	{ label: "Chicago (CST)", value: "America/Chicago" },
	{ label: "London (BST)", value: "Europe/London" },
	{ label: "Tokyo (JST)", value: "Asia/Tokyo" },
];

export default function ChartFooter() {
	const { toggleFeatureSpotlight } = useUIStore();
	const { chartSettings, setTimezone } = useChartStore();
	const currentTimezone = chartSettings.timezone || "UTC";

	const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setTimezone(e.target.value);
	};

	return (
		<div className="w-full h-8 bg-card border-t border-border flex items-center justify-end px-4 z-30 select-none">
			<div className="flex items-center text-xs text-muted-foreground">
				<select
					value={currentTimezone}
					onChange={handleTimezoneChange}
					className="bg-transparent border-none outline-none cursor-pointer hover:text-foreground focus:ring-0 py-0 pr-6 text-xs font-medium appearance-none"
					style={{ textAlignLast: 'right' }}
				>
					{TIMEZONES.map((tz) => (
						<option key={tz.value} value={tz.value}>
							{tz.label}
						</option>
					))}
				</select>
				<span className="pointer-events-none -ml-4 mt-0.5 text-muted-foreground">
					▼
				</span>
			</div>

			<div
				className="ml-3 flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer transition-colors"
				onClick={() => toggleFeatureSpotlight(true)}
			>
				<span className="text-[10px] font-bold">?</span>
			</div>


		</div>
	);
}
