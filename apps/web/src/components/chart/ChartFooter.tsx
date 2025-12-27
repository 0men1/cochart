"use client"

import { useApp } from "./context";

const TIMEZONES = [
    { label: "UTC", value: "UTC" },
    { label: "New York (EST)", value: "America/New_York" },
    { label: "Chicago (CST)", value: "America/Chicago" },
    { label: "London (BST)", value: "Europe/London" },
    { label: "Tokyo (JST)", value: "Asia/Tokyo" },
];

export default function ChartFooter() {
    const { state, action } = useApp();
    const currentTimezone = state.settings.timezone || "UTC";

    const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        action.setTimezone(e.target.value);
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
        </div>
    );
}
