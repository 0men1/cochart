'use client';

import { useEffect, useState } from 'react';
import { X, Palette, Grid3x3, ChartCandlestick as CandleIcon, Moon, Sun, LucideIcon } from 'lucide-react';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { ChartSettings, useApp } from '@/components/chart/context';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Settings tab configuration
 * Each tab represents a major settings category
 */
interface SettingsTab {
    id: string;
    label: string;
    icon: LucideIcon;
}

const SETTINGS_TABS: SettingsTab[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'grid', label: 'Grid', icon: Grid3x3 },
    { id: 'candles', label: 'Candles', icon: CandleIcon },
];

export default function Settings() {
    const { state, action } = useApp();
    const { settings } = state.chart;

    const [localSettings, setLocalSettings] = useState<ChartSettings | null>(null);
    const [activeTab, setActiveTab] = useState<string>('appearance');

    useEffect(() => {
        if (settings.isOpen) {
            const copy = JSON.parse(JSON.stringify(settings));
            setLocalSettings(copy);
        }
    }, [settings.isOpen, settings]);

    if (!settings.isOpen || !localSettings) return null;

    const cancel = () => {
        action.toggleSettings(false);
    };

    const save = () => {
        action.updateSettings(localSettings);
        action.toggleSettings(false);
    };

    /**
     * Updates a nested setting value using dot notation path
     * @param path - Dot notation path (e.g., 'background.theme' or 'candles.upColor')
     * @param value - New value to set
     */
    const updateLocal = (path: string, value: any) => {
        setLocalSettings(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            let target = copy;
            const keys = path.split('.');
            while (keys.length > 1) {
                const k = keys.shift()!;
                target = target[k];
            }
            target[keys[0]] = value;
            return copy;
        });
    };

    const isDark = localSettings.background.theme === "dark";

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center transition-opacity"
            onClick={cancel}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl z-50 w-full max-w-3xl mx-4 h-[75vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Palette size={18} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancel}
                        className="rounded-full h-8 w-8 p-0 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        <X size={18} />
                    </Button>
                </div>

                {/* Content - Tabs + Panel */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Icon-only Tabs */}
                    <div className="w-16 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2 flex flex-col gap-2">
                        {SETTINGS_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <Tooltip key={tab.id}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${isActive
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            <Icon size={20} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>{tab.label}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>

                    {/* Right Panel - Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'appearance' && (
                            <AppearanceSection
                                settings={localSettings}
                                isDark={isDark}
                                updateLocal={updateLocal}
                            />
                        )}
                        {activeTab === 'grid' && (
                            <GridSection
                                settings={localSettings}
                                updateLocal={updateLocal}
                            />
                        )}
                        {activeTab === 'candles' && (
                            <CandlesSection
                                settings={localSettings}
                                updateLocal={updateLocal}
                            />
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                    <Button onClick={cancel} variant="outline" className="flex-1 h-10 font-medium">
                        Cancel
                    </Button>
                    <Button onClick={save} className="flex-1 h-10 font-medium bg-blue-600 hover:bg-blue-700">
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * APPEARANCE SECTION
 * Controls overall chart appearance like theme mode
 * 
 * Settings Path: state.chart.settings.background.theme
 * 
 * To add new appearance settings:
 * 1. Add the setting to ChartSettings type in context
 * 2. Add UI control here
 * 3. Use updateLocal() with proper path notation
 */
interface AppearanceSectionProps {
    settings: ChartSettings;
    isDark: boolean;
    updateLocal: (path: string, value: any) => void;
}

function AppearanceSection({ settings, isDark, updateLocal }: AppearanceSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Appearance</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Customize the overall look and feel of your chart
                </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-amber-100'}`}>
                        {isDark ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-amber-600" />}
                    </div>
                    <div>
                        <Label htmlFor="theme-toggle" className="text-sm font-medium cursor-pointer">Theme Mode</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{isDark ? 'Dark' : 'Light'} theme active</p>
                    </div>
                </div>
                <Switch
                    id="theme-toggle"
                    checked={isDark}
                    onCheckedChange={(checked) =>
                        updateLocal('background.theme', checked ? "dark" : "light")
                    }
                />
            </div>
        </div>
    );
}

/**
 * GRID SECTION
 * Controls grid line visibility and styling
 * 
 * Settings Path: 
 * - state.chart.settings.background.grid.vertLines
 * - state.chart.settings.background.grid.horzLines
 * 
 * To add new grid settings:
 * 1. Extend the grid object in ChartSettings type
 * 2. Add UI controls here (e.g., color pickers, width sliders)
 * 3. Use updateLocal() with paths like 'background.grid.vertLines.color'
 */
interface GridSectionProps {
    settings: ChartSettings;
    updateLocal: (path: string, value: any) => void;
}

function GridSection({ settings, updateLocal }: GridSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Grid Options</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure grid lines and background elements
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div>
                        <Label htmlFor="vert-lines" className="text-sm font-medium cursor-pointer">Vertical Lines</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Show vertical grid lines</p>
                    </div>
                    <Switch
                        id="vert-lines"
                        checked={settings.background.grid.vertLines.visible}
                        onCheckedChange={(checked) =>
                            updateLocal('background.grid.vertLines.visible', checked)
                        }
                    />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div>
                        <Label htmlFor="horz-lines" className="text-sm font-medium cursor-pointer">Horizontal Lines</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Show horizontal grid lines</p>
                    </div>
                    <Switch
                        id="horz-lines"
                        checked={settings.background.grid.horzLines.visible}
                        onCheckedChange={(checked) =>
                            updateLocal('background.grid.horzLines.visible', checked)
                        }
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * CANDLES SECTION
 * Controls candlestick appearance and styling
 * 
 * Settings Path: state.chart.settings.candles
 * 
 * To add new candle settings:
 * 1. Add properties to candles object in ChartSettings type
 * 2. Add UI controls here (e.g., for hollow candles, bar charts)
 * 3. Use updateLocal() with paths like 'candles.upColor' or 'candles.borderVisible'
 */
interface CandlesSectionProps {
    settings: ChartSettings;
    updateLocal: (path: string, value: any) => void;
}

function CandlesSection({ settings, updateLocal }: CandlesSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Candle Styles</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Customize candlestick colors and appearance
                </p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="up-color" className="text-xs font-medium">Bullish Color</Label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Input
                                id="up-color"
                                type="color"
                                value={settings.candles.upColor}
                                onChange={(e) =>
                                    updateLocal('candles.upColor', e.target.value)
                                }
                                className="w-10 h-10 p-1 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{settings.candles.upColor}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="down-color" className="text-xs font-medium">Bearish Color</Label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Input
                                id="down-color"
                                type="color"
                                value={settings.candles.downColor}
                                onChange={(e) =>
                                    updateLocal('candles.downColor', e.target.value)
                                }
                                className="w-10 h-10 p-1 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{settings.candles.downColor}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wick-up-color" className="text-xs font-medium">Bullish Wick</Label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Input
                                id="wick-up-color"
                                type="color"
                                value={settings.candles.wickupColor}
                                onChange={(e) =>
                                    updateLocal('candles.wickupColor', e.target.value)
                                }
                                className="w-10 h-10 p-1 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{settings.candles.wickupColor}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wick-down-color" className="text-xs font-medium">Bearish Wick</Label>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Input
                                id="wick-down-color"
                                type="color"
                                value={settings.candles.wickDownColor}
                                onChange={(e) =>
                                    updateLocal('candles.wickDownColor', e.target.value)
                                }
                                className="w-10 h-10 p-1 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{settings.candles.wickDownColor}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div>
                        <Label htmlFor="border-visible" className="text-sm font-medium cursor-pointer">Candle Borders</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Show borders around candles</p>
                    </div>
                    <Switch
                        id="border-visible"
                        checked={settings.candles.borderVisible}
                        onCheckedChange={(checked) =>
                            updateLocal('candles.borderVisible', checked)
                        }
                    />
                </div>
            </div>
        </div>
    );
}
