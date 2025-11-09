'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { ChartSettings, useApp } from '@/components/chart/context';

export default function Settings() {
    const { state, action } = useApp();
    const { settings } = state.chart;

    const [localSettings, setLocalSettings] = useState<ChartSettings | null>(null);

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

    const updateLocal = (path: any, value: any) => {
        setLocalSettings(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            let target = copy;
            const keys = path.split('.');
            while (keys.length > 1) {
                const k = keys.shift();
                target = target[k];
            }
            target[keys[0]] = value;
            return copy;
        });
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center transition-opacity"
            onClick={cancel}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl z-50 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold">Chart Settings</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancel}
                        className="rounded-full h-8 w-8 p-0"
                    >
                        <X size={20} />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-medium mb-4">Appearance</h3>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="theme-toggle">Dark mode</Label>
                            <Switch
                                id="theme-toggle"
                                checked={localSettings.background.theme === "dark"}
                                onCheckedChange={(checked) =>
                                    updateLocal('background.theme', checked ? "dark" : "light")
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-4">Grid Options</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="vert-lines">Vertical Grid Lines</Label>
                                <Switch
                                    id="vert-lines"
                                    checked={localSettings.background.grid.vertLines.visible}
                                    onCheckedChange={(checked) =>
                                        updateLocal('background.grid.vertLines.visible', checked)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="horz-lines">Horizontal Grid Lines</Label>
                                <Switch
                                    id="horz-lines"
                                    checked={localSettings.background.grid.horzLines.visible}
                                    onCheckedChange={(checked) =>
                                        updateLocal('background.grid.horzLines.visible', checked)
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-4">Candle Colors</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="up-color">Bullish (Up) Color</Label>
                                <Input
                                    id="up-color"
                                    type="color"
                                    value={localSettings.candles.upColor}
                                    onChange={(e) =>
                                        updateLocal('candles.upColor', e.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="down-color">Bearish (Down) Color</Label>
                                <Input
                                    id="down-color"
                                    type="color"
                                    value={localSettings.candles.downColor}
                                    onChange={(e) =>
                                        updateLocal('candles.downColor', e.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="wick-up-color">Bullish Wick Color</Label>
                                <Input
                                    id="wick-up-color"
                                    type="color"
                                    value={localSettings.candles.wickupColor}
                                    onChange={(e) =>
                                        updateLocal('candles.wickupColor', e.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="wick-down-color">Bearish Wick Color</Label>
                                <Input
                                    id="wick-down-color"
                                    type="color"
                                    value={localSettings.candles.wickDownColor}
                                    onChange={(e) =>
                                        updateLocal('candles.wickDownColor', e.target.value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="border-visible">Show Candle Borders</Label>
                                <Switch
                                    id="border-visible"
                                    checked={localSettings.candles.borderVisible}
                                    onCheckedChange={(checked) =>
                                        updateLocal('candles.borderVisible', checked)
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex space-x-3">
                    <Button onClick={cancel} variant="outline" className="flex-1 hover:bg-gray-500">
                        Cancel
                    </Button>
                    <Button onClick={save} variant="default" className="flex-1 hover:bg-gray-700">
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}
