'use client';

import { useEffect, useState } from 'react';
import { Palette, Grid3x3, ChartCandlestick, Moon, Sun } from 'lucide-react';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Modal, ModalClose } from "../ui/modal";
import { cn } from "@/lib/utils";
import { useChartStore } from '@/stores/useChartStore';
import { ChartSettings } from '@/stores/types';

const SettingRow = ({ label, desc, children }: { label: string, desc?: string, children: React.ReactNode }) => (
	<div className="flex items-center justify-between py-3">
		<div className="space-y-0.5">
			<Label className="text-sm font-medium text-foreground">{label}</Label>
			{desc && <p className="text-[13px] text-muted-foreground">{desc}</p>}
		</div>
		{children}
	</div>
);

const ColorRow = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
	<div className="flex items-center justify-between py-2">
		<span className="text-sm text-muted-foreground">{label}</span>
		<div className="flex items-center gap-2">
			<span className="text-xs font-mono text-muted-foreground uppercase">{value}</span>
			<div className="relative group">
				<div
					className="w-8 h-8 rounded-full border border-border shadow-sm cursor-pointer transition-transform group-hover:scale-105"
					style={{ backgroundColor: value }}
				/>
				<input
					type="color"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
				/>
			</div>
		</div>
	</div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
	<button
		onClick={onClick}
		className={cn(
			"flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
			active
				? "bg-accent text-foreground"
				: "text-muted-foreground hover:text-foreground hover:bg-accent/50"
		)}
	>
		<Icon size={16} />
		{label}
	</button>
);

// --- Main Component ---

export default function SettingsPanel() {
	const {
		toggleChartSettings,
		setChartSettings,
		chartSettings
	} = useChartStore();

	const [localChartSettings, setLocalChartSettings] = useState<ChartSettings | null>(null);
	const [activeTab, setActiveTab] = useState<'appearance' | 'grid' | 'candles'>('appearance');

	useEffect(() => {
		if (chartSettings.isOpen) {
			setLocalChartSettings(chartSettings);
		}
	}, [chartSettings.isOpen]);

	if (!chartSettings.isOpen || !localChartSettings) return null;

	const handleSave = () => {
		setChartSettings(localChartSettings);
		toggleChartSettings(false);
	};

	const updateLocal = (path: string, value: any) => {
		setLocalChartSettings(prev => {
			if (!prev) return null;
			const copy = JSON.parse(JSON.stringify(prev));
			const keys = path.split('.');
			let target = copy;
			while (keys.length > 1) target = target[keys.shift()!];
			target[keys[0]] = value;
			return copy;
		});
	};

	return (
		<Modal
			open
			onClose={() => toggleChartSettings(false)}
			aria-label="Chart settings"
			className="max-w-md overflow-hidden flex flex-col max-h-[85vh]"
		>
			{/* Header */}
			<div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
				<div>
					<h2 className="text-lg font-semibold tracking-tight text-foreground">Settings</h2>
					<p className="text-sm text-muted-foreground">Manage your chart preferences</p>
				</div>
				<ModalClose onClick={() => toggleChartSettings(false)} />
			</div>

			{/* Tabs Navigation */}
			<div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto shrink-0 no-scrollbar">
					<TabButton
						active={activeTab === 'appearance'}
						onClick={() => setActiveTab('appearance')}
						icon={Palette}
						label="Appearance"
					/>
					<TabButton
						active={activeTab === 'grid'}
						onClick={() => setActiveTab('grid')}
						icon={Grid3x3}
						label="Grid"
					/>
					<TabButton
						active={activeTab === 'candles'}
						onClick={() => setActiveTab('candles')}
						icon={ChartCandlestick}
						label="Candles"
					/>
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

					{activeTab === 'appearance' && (
						<div className="space-y-1">
							<SettingRow label="Theme Mode" desc="Toggle between light and dark mode">
								<div className="flex items-center gap-3">
									{localChartSettings.background.theme === 'dark'
										? <Moon size={16} className="text-muted-foreground" />
										: <Sun size={16} className="text-muted-foreground" />
									}
									<Switch
										checked={localChartSettings.background.theme === 'dark'}
										onCheckedChange={(c) => updateLocal('background.theme', c ? 'dark' : 'light')}
									/>
								</div>
							</SettingRow>
						</div>
					)}

					{activeTab === 'grid' && (
						<div className="space-y-1">
							<SettingRow label="Vertical Lines" desc="Show vertical time dividers">
								<Switch
									checked={localChartSettings.background.grid.vertLines.visible}
									onCheckedChange={(c) => updateLocal('background.grid.vertLines.visible', c)}
								/>
							</SettingRow>
							<div className="my-2 border-t border-border" />
							<SettingRow label="Horizontal Lines" desc="Show horizontal price dividers">
								<Switch
									checked={localChartSettings.background.grid.horzLines.visible}
									onCheckedChange={(c) => updateLocal('background.grid.horzLines.visible', c)}
								/>
							</SettingRow>
						</div>
					)}

					{activeTab === 'candles' && (
						<div className="space-y-4">
							<div className="space-y-1">
								<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Colors</h3>
								<ColorRow
									label="Bullish Body"
									value={localChartSettings.candles.upColor}
									onChange={(v) => updateLocal('candles.upColor', v)}
								/>
								<ColorRow
									label="Bearish Body"
									value={localChartSettings.candles.downColor}
									onChange={(v) => updateLocal('candles.downColor', v)}
								/>
								<ColorRow
									label="Bullish Wick"
									value={localChartSettings.candles.wickupColor}
									onChange={(v) => updateLocal('candles.wickupColor', v)}
								/>
								<ColorRow
									label="Bearish Wick"
									value={localChartSettings.candles.wickDownColor}
									onChange={(v) => updateLocal('candles.wickDownColor', v)}
								/>
							</div>

							<div className="my-4 border-t border-border" />

							<div className="space-y-1">
								<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Style</h3>
								<SettingRow label="Candle Borders" desc="Draw borders around candle bodies">
									<Switch
										checked={localChartSettings.candles.borderVisible}
										onCheckedChange={(c) => updateLocal('candles.borderVisible', c)}
									/>
								</SettingRow>
							</div>
						</div>
					)}
				</div>

			{/* Footer */}
			<div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
				<Button variant="ghost" onClick={() => toggleChartSettings(false)}>
					Cancel
				</Button>
				<Button onClick={handleSave} className="min-w-[80px]">
					Save
				</Button>
			</div>
		</Modal>
	);
}
