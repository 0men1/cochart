import { ChevronDown, Settings, Wifi, Share2, Users, TrendingUp } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatus, IntervalKey } from "@/core/chart/market-data/types";
import { useApp } from "@/components/chart/context";


function getStatusDiv(status: ConnectionStatus) {
    switch (status) {
        case ConnectionStatus.CONNECTED:
            return (<span className="text-green-500">●</span>)
        case ConnectionStatus.DISCONNECTED:
            return (<span className="text-red-500">●</span>)
        case ConnectionStatus.CONNECTING:
            break;
        case ConnectionStatus.ERROR:
            break;
        case ConnectionStatus.RECONNECTING:
            return (<span className="text-yellow-500">●</span>)
    }
}

export default function ChartHeader() {
    const { state, action } = useApp();

    const tickers: string[] = ["SOL-USD", "BTC-USD", "ETH-USD"];
    const timeframes: string[] = ["1m", "5m", "15m", "1H", "4H", "1D"];

    const handleChartUpdate = (symbol: string, timeframe: IntervalKey, exchange: string) => {
        action.selectChart(symbol, timeframe, exchange);
    };

    const isInRoom = state.collaboration.room.id != null;

    return (
        <div className="flex justify-between items-center w-full h-12 px-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            {/* Left side components */}
            <div className="flex items-center space-x-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                    <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />

                    {/* Ticker selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 h-7 px-2"
                            >
                                {state.chart.data.symbol} <ChevronDown size={14} className="ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            {tickers.map((symbol) => (
                                <DropdownMenuItem
                                    key={symbol}
                                    onClick={() => handleChartUpdate(symbol, state.chart.data.timeframe, state.chart.data.exchange)}
                                    className={`cursor-pointer ${symbol === state.chart.data.symbol ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                                >
                                    <TrendingUp size={14} className="mr-2 text-blue-500" />
                                    {symbol}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="w-px h-5 bg-blue-200 dark:bg-blue-800" />

                    {/* Timeframe selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 h-7 px-2"
                            >
                                {state.chart.data.timeframe} <ChevronDown size={14} className="ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-24">
                            {timeframes.map((time) => (
                                <DropdownMenuItem
                                    key={time}
                                    onClick={() => handleChartUpdate(state.chart.data.symbol, time as IntervalKey, state.chart.data.exchange)}
                                    className={`cursor-pointer justify-center ${time === state.chart.data.timeframe ? 'bg-blue-50 dark:bg-blue-950 font-semibold' : ''}`}
                                >
                                    {time}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="flex items-center gap-7">
                <Button
                    onClick={() => { action.toggleCollabWindow(true) }}
                    className={isInRoom ? "bg-emerald-600 hover:bg-emerald-700 relative" : ""}
                >
                    {isInRoom ? (
                        <>
                            <Users size={16} className="mr-2" />
                            <span>Live</span>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                        </>
                    ) : (
                        <>
                            <Share2 size={16} className="mr-2" />
                            <span>Share</span>
                        </>
                    )}
                </Button>

                {/* Connection Status Icon with Tooltip */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-2">
                            <Wifi size={18} className="text-slate-600 dark:text-slate-400" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="p-3 max-w-xs">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Connection Status</h4>
                            <div className="space-y-1 text-xs">
                                {/* Add your connection statuses here */}
                                <div className="flex items-center justify-between">
                                    <span>Collab Connection:</span>
                                    {getStatusDiv(state.collaboration.room.status)}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Candle Data:</span>
                                    {getStatusDiv(state.chart.data.state.status)}
                                </div>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>

                <Button
                    variant="outline"
                    size="lg"
                    className="rounded-md"
                    onClick={() => action.toggleSettings(true)}
                >
                    <Settings size={18} />
                </Button>
            </div>
        </div>
    );
}
