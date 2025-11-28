'use client'
import { useEffect } from "react";
import { MoveDiagonal, MoveUp } from "lucide-react";
import { DrawingHandlerFactory } from "@/core/chart/drawings/DrawingHandlerFactory";
import { Button } from "../ui/button";
import { DrawingTool } from "@/core/chart/drawings/types";
import { useApp } from "@/components/chart/context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * TOOLBOX COMPONENT
 * Vertical toolbar for chart drawing tools
 * 
 * To add new drawing tools:
 * 1. Add the tool type to DrawingTool union in types
 * 2. Implement the handler in DrawingHandlerFactory
 * 3. Add button configuration to the buttons array below
 * 4. Icon should be from lucide-react
 */

function Toolbox() {
    const { state, action, chartRef, seriesRef } = useApp();
    const { activeTool } = state.chart.tools

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && activeTool) {
                action.cancelTool()
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("keydown", handleEscape);
        }
    }, [activeTool, action]);

    function setTool(tool: DrawingTool) {
        if (!chartRef.current || !seriesRef.current) return;

        if (tool === activeTool) {
            action.cancelTool()
            return;
        }

        const handlerFactory = new DrawingHandlerFactory(chartRef.current, seriesRef.current);
        try {
            const handler = handlerFactory.createHandler(tool);
            if (handler) {
                action.startTool(tool, handler)
            }
        } catch (error) {
            console.error("failed to set tool: ", error);
            action.cancelTool()
        }
    }

    const buttons = [
        { tool: "verticalLine" as DrawingTool, icon: MoveUp, label: "Vertical Line" },
        { tool: "trendline" as DrawingTool, icon: MoveDiagonal, label: "Trendline" },
    ];

    return (
        <div className="flex flex-col gap-1 py-2 px-1 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700">
            {buttons.map(({ tool, icon: Icon, label }) => {
                const isActive = activeTool === tool;
                return (
                    <Tooltip key={tool}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-11 w-11 rounded-lg transition-all ${isActive
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                onClick={() => setTool(tool)}
                            >
                                <Icon size={20} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p className="font-medium">{label}</p>
                            <p className="text-xs text-slate-400">ESC to cancel</p>
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
};

export default Toolbox;
