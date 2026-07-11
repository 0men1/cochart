"use client"

import { useChartStore } from "@/stores/useChartStore";
import { useUIStore } from "@/stores/useUIStore";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const TIMEZONES = [
	{ label: `Local (${LOCAL_TZ})`, value: LOCAL_TZ },
	{ label: "UTC", value: "UTC" },
	{ label: "New York (EST)", value: "America/New_York" },
	{ label: "Chicago (CST)", value: "America/Chicago" },
	{ label: "London (BST)", value: "Europe/London" },
	{ label: "Tokyo (JST)", value: "Asia/Tokyo" },
	// De-dupe if the browser's local zone matches one of the named zones below.
].filter((tz, i, arr) => arr.findIndex((t) => t.value === tz.value) === i);

export default function ChartFooter() {
	const { toggleFeatureSpotlight } = useUIStore();
	const { chartSettings, setTimezone } = useChartStore();
	const currentTimezone = chartSettings.timezone || "UTC";

	return (
		<div className="w-full h-8 bg-card border-t border-border flex items-center justify-end px-4 z-30 select-none">
			<Select value={currentTimezone} onValueChange={setTimezone}>
				<SelectTrigger
					size="sm"
					className="h-6 gap-1 border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="end">
					{TIMEZONES.map((tz) => (
						<SelectItem key={tz.value} value={tz.value} className="text-xs">
							{tz.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div
				className="ml-3 flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer transition-colors"
				onClick={() => toggleFeatureSpotlight(true)}
			>
				<span className="text-[10px] font-bold">?</span>
			</div>
		</div>
	);
}
