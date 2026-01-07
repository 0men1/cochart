"use client"

import { useUIStore } from "@/stores/useUIStore";

const TIMEZONES = [
	{ label: "UTC", value: "UTC" },
	{ label: "New York (EST)", value: "America/New_York" },
	{ label: "Chicago (CST)", value: "America/Chicago" },
	{ label: "London (BST)", value: "Europe/London" },
	{ label: "Tokyo (JST)", value: "Asia/Tokyo" },
];

export default function ChartFooter() {
	const { toggleFeatureSpotlight, setTimezone, settings } = useUIStore();
	const currentTimezone = settings.timezone || "UTC";

	const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setTimezone(e.target.value);
		console.log("New timezone:", e.target.value);
	};

	return (
		<div className="w-full h-8 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end px-4 z-30 select-none">
			<div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
				<select
					value={currentTimezone}
					onChange={handleTimezoneChange}
					className="bg-transparent border-none outline-none cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 focus:ring-0 py-0 pr-6 text-xs font-medium appearance-none"
					style={{ textAlignLast: 'right' }}
				>
					{TIMEZONES.map((tz) => (
						<option key={tz.value} value={tz.value}>
							{tz.label}
						</option>
					))}
				</select>
				<span className="pointer-events-none -ml-4 mt-0.5 text-gray-400">
					▼
				</span>
			</div>

			<div
				className="ml-3 flex items-center justify-center w-5 h-5 rounded-full border border-gray-400/50 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-600 dark:hover:border-gray-200 cursor-pointer transition-colors"
				onClick={() => toggleFeatureSpotlight(true)}
			>
				<span className="text-[10px] font-bold">?</span>
			</div>


		</div>
	);
}
