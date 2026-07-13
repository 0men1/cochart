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
import { Button } from "../ui/button";
import { Wifi } from "lucide-react";
import { ConnectionStatus } from "@/core/chart/market-data/types";
import { useCollabStore } from "@/stores/useCollabStore";
import { Tooltip, TooltipContent } from "../ui/tooltip";
import { TooltipTrigger } from "@radix-ui/react-tooltip";

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

function getStatusDiv(status: ConnectionStatus) {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return (<span className="text-live">●</span>)
    case ConnectionStatus.DISCONNECTED:
      return (<span className="text-destructive">●</span>)
    case ConnectionStatus.CONNECTING:
      break;
    case ConnectionStatus.ERROR:
      break;
    case ConnectionStatus.RECONNECTING:
      return (<span className="text-yellow-500">●</span>)
  }
}
export default function ChartFooter() {
  const { toggleWelcomeTour } = useUIStore();
  const { data, chartSettings, setTimezone } = useChartStore();
  const { status } = useCollabStore();
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


      {/* Connection Status Icon with Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Wifi size={18} className="text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3 max-w-xs">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Connection Status</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Collab Connection:</span>
                {getStatusDiv(status)}
              </div>
              <div className="flex items-center justify-between">
                <span>Candle Data:</span>
                {getStatusDiv(data.connectionState.status)}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      <div
        className="ml-3 flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer transition-colors"
        onClick={() => toggleWelcomeTour(true)}
      >
        <span className="text-[10px] font-bold">?</span>
      </div>
    </div>
  );
}
