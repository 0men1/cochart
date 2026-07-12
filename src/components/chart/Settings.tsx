'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, Grid3x3, ChartCandlestick, Crosshair, Moon, Sun } from 'lucide-react';
import { CrosshairMode, LineStyle } from 'cochart-charts';
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Modal, ModalClose } from "../ui/modal";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";
import { useChartStore } from '@/stores/useChartStore';
import { ChartSettings } from '@/stores/types';

// --- Option lists ---

const LINE_STYLE_OPTIONS = [
	{ value: LineStyle.Solid, label: 'Solid' },
	{ value: LineStyle.Dotted, label: 'Dotted' },
	{ value: LineStyle.Dashed, label: 'Dashed' },
	{ value: LineStyle.LargeDashed, label: 'Large dashed' },
	{ value: LineStyle.SparseDotted, label: 'Sparse dotted' },
];

const CROSSHAIR_MODE_OPTIONS = [
	{ value: CrosshairMode.Normal, label: 'Normal (free)' },
	{ value: CrosshairMode.Magnet, label: 'Magnet (close)' },
	{ value: CrosshairMode.MagnetOHLC, label: 'Magnet (OHLC)' },
	{ value: CrosshairMode.Hidden, label: 'Hidden' },
];

const LINE_WIDTH_OPTIONS = [1, 2, 3, 4].map((w) => ({ value: w, label: String(w) }));

const TIMEZONE_OPTIONS = [
	'UTC',
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'America/Sao_Paulo',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Moscow',
	'Asia/Dubai',
	'Asia/Kolkata',
	'Asia/Singapore',
	'Asia/Hong_Kong',
	'Asia/Tokyo',
	'Australia/Sydney',
];

// --- Row helpers ---

const SettingRow = ({ label, desc, children }: { label: string, desc?: string, children: React.ReactNode }) => (
	<div className="flex items-center justify-between py-3">
		<div className="space-y-0.5 pr-4">
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

const CheckboxRow = ({ label, desc, checked, onChange, children }: {
	label: string, desc?: string, checked: boolean, onChange: (checked: boolean) => void, children?: React.ReactNode
}) => (
	<SettingRow label={label} desc={desc}>
		<div className="flex items-center gap-3">
			{children}
			<Checkbox
				className="size-5"
				checked={checked}
				onCheckedChange={(c) => onChange(c === true)}
			/>
		</div>
	</SettingRow>
);

function SelectRow<T extends string | number>({ label, desc, value, options, onChange, triggerClassName }: {
	label: string,
	desc?: string,
	value: T,
	options: { value: T, label: string }[],
	onChange: (value: T) => void,
	triggerClassName?: string,
}) {
	return (
		<SettingRow label={label} desc={desc}>
			<Select
				value={String(value)}
				onValueChange={(s) => {
					const opt = options.find((o) => String(o.value) === s);
					if (opt) onChange(opt.value);
				}}
			>
				<SelectTrigger className={cn("w-[170px]", triggerClassName)}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((o) => (
						<SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingRow>
	);
}

const NumberRow = ({ label, desc, value, min, max, onChange }: {
	label: string, desc?: string, value: number, min?: number, max?: number, onChange: (value: number) => void
}) => (
	<SettingRow label={label} desc={desc}>
		<Input
			type="number"
			value={value}
			min={min}
			max={max}
			onChange={(e) => {
				const n = Number(e.target.value);
				if (!Number.isNaN(n)) onChange(n);
			}}
			className="w-20"
		/>
	</SettingRow>
);

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
	<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{children}</h3>
);

const Divider = () => <div className="my-3 border-t border-border" />;

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

type Tab = 'general' | 'grid' | 'crosshair' | 'candles';

// --- Main Component ---

export default function SettingsPanel() {
	const {
		toggleChartSettings,
		setChartSettings,
		chartSettings
	} = useChartStore();

	const [localChartSettings, setLocalChartSettings] = useState<ChartSettings | null>(null);
	const [activeTab, setActiveTab] = useState<Tab>('general');

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

	const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const timezoneOptions = [...new Set([systemTz, localChartSettings.timezone, ...TIMEZONE_OPTIONS])]
		.map((tz) => ({ value: tz, label: tz === systemTz ? `${tz} (System)` : tz }));

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
				<TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={SlidersHorizontal} label="General" />
				<TabButton active={activeTab === 'grid'} onClick={() => setActiveTab('grid')} icon={Grid3x3} label="Grid" />
				<TabButton active={activeTab === 'crosshair'} onClick={() => setActiveTab('crosshair')} icon={Crosshair} label="Crosshair" />
				<TabButton active={activeTab === 'candles'} onClick={() => setActiveTab('candles')} icon={ChartCandlestick} label="Candles" />
			</div>

			{/* Scrollable Content */}
			<div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

				{activeTab === 'general' && (
					<div className="space-y-1">
						<CheckboxRow
							label="Dark mode"
							desc="Use the dark color theme"
							checked={localChartSettings.background.theme === 'dark'}
							onChange={(c) => updateLocal('background.theme', c ? 'dark' : 'light')}
						>
							{localChartSettings.background.theme === 'dark'
								? <Moon size={16} className="text-muted-foreground" />
								: <Sun size={16} className="text-muted-foreground" />
							}
						</CheckboxRow>
						<Divider />
						<SelectRow
							label="Timezone"
							desc="Time axis and crosshair labels"
							value={localChartSettings.timezone}
							options={timezoneOptions}
							onChange={(v) => updateLocal('timezone', v)}
							triggerClassName="w-[200px]"
						/>
						<Divider />
						<NumberRow
							label="Scale font size"
							desc="Font size of axis labels (px)"
							value={localChartSettings.layout.fontSize}
							min={8}
							max={40}
							onChange={(v) => updateLocal('layout.fontSize', v)}
						/>
					</div>
				)}

				{activeTab === 'grid' && (
					<div className="space-y-4">
						<div className="space-y-1">
							<SectionHeader>Vertical lines</SectionHeader>
							<CheckboxRow
								label="Visible"
								checked={localChartSettings.background.grid.vertLines.visible}
								onChange={(c) => updateLocal('background.grid.vertLines.visible', c)}
							/>
							<ColorRow
								label="Color"
								value={localChartSettings.background.grid.vertLines.color}
								onChange={(v) => updateLocal('background.grid.vertLines.color', v)}
							/>
							<SelectRow
								label="Style"
								value={localChartSettings.background.grid.vertLines.style}
								options={LINE_STYLE_OPTIONS}
								onChange={(v) => updateLocal('background.grid.vertLines.style', v)}
							/>
						</div>
						<Divider />
						<div className="space-y-1">
							<SectionHeader>Horizontal lines</SectionHeader>
							<CheckboxRow
								label="Visible"
								checked={localChartSettings.background.grid.horzLines.visible}
								onChange={(c) => updateLocal('background.grid.horzLines.visible', c)}
							/>
							<ColorRow
								label="Color"
								value={localChartSettings.background.grid.horzLines.color}
								onChange={(v) => updateLocal('background.grid.horzLines.color', v)}
							/>
							<SelectRow
								label="Style"
								value={localChartSettings.background.grid.horzLines.style}
								options={LINE_STYLE_OPTIONS}
								onChange={(v) => updateLocal('background.grid.horzLines.style', v)}
							/>
						</div>
					</div>
				)}

				{activeTab === 'crosshair' && (
					<div className="space-y-4">
						<div className="space-y-1">
							<SelectRow
								label="Mode"
								desc="How the crosshair snaps to data"
								value={localChartSettings.cursor}
								options={CROSSHAIR_MODE_OPTIONS}
								onChange={(v) => updateLocal('cursor', v)}
							/>
						</div>
						<Divider />
						<div className="space-y-1">
							<SectionHeader>Vertical line</SectionHeader>
							<CheckboxRow
								label="Visible"
								checked={localChartSettings.crosshair.vertLine.visible}
								onChange={(c) => updateLocal('crosshair.vertLine.visible', c)}
							/>
							<ColorRow
								label="Color"
								value={localChartSettings.crosshair.vertLine.color}
								onChange={(v) => updateLocal('crosshair.vertLine.color', v)}
							/>
							<SelectRow
								label="Width"
								value={localChartSettings.crosshair.vertLine.width}
								options={LINE_WIDTH_OPTIONS}
								onChange={(v) => updateLocal('crosshair.vertLine.width', v)}
							/>
							<SelectRow
								label="Style"
								value={localChartSettings.crosshair.vertLine.style}
								options={LINE_STYLE_OPTIONS}
								onChange={(v) => updateLocal('crosshair.vertLine.style', v)}
							/>
						</div>
						<Divider />
						<div className="space-y-1">
							<SectionHeader>Horizontal line</SectionHeader>
							<CheckboxRow
								label="Visible"
								checked={localChartSettings.crosshair.horzLine.visible}
								onChange={(c) => updateLocal('crosshair.horzLine.visible', c)}
							/>
							<ColorRow
								label="Color"
								value={localChartSettings.crosshair.horzLine.color}
								onChange={(v) => updateLocal('crosshair.horzLine.color', v)}
							/>
							<SelectRow
								label="Width"
								value={localChartSettings.crosshair.horzLine.width}
								options={LINE_WIDTH_OPTIONS}
								onChange={(v) => updateLocal('crosshair.horzLine.width', v)}
							/>
							<SelectRow
								label="Style"
								value={localChartSettings.crosshair.horzLine.style}
								options={LINE_STYLE_OPTIONS}
								onChange={(v) => updateLocal('crosshair.horzLine.style', v)}
							/>
						</div>
					</div>
				)}

				{activeTab === 'candles' && (
					<div className="space-y-4">
						<div className="space-y-1">
							<SectionHeader>Body</SectionHeader>
							<ColorRow
								label="Bullish"
								value={localChartSettings.candles.upColor}
								onChange={(v) => updateLocal('candles.upColor', v)}
							/>
							<ColorRow
								label="Bearish"
								value={localChartSettings.candles.downColor}
								onChange={(v) => updateLocal('candles.downColor', v)}
							/>
						</div>

						<Divider />

						<div className="space-y-1">
							<SectionHeader>Wick</SectionHeader>
							<CheckboxRow
								label="Show wicks"
								checked={localChartSettings.candles.wickVisible}
								onChange={(c) => updateLocal('candles.wickVisible', c)}
							/>
							<ColorRow
								label="Bullish"
								value={localChartSettings.candles.wickupColor}
								onChange={(v) => updateLocal('candles.wickupColor', v)}
							/>
							<ColorRow
								label="Bearish"
								value={localChartSettings.candles.wickDownColor}
								onChange={(v) => updateLocal('candles.wickDownColor', v)}
							/>
						</div>

						<Divider />

						<div className="space-y-1">
							<SectionHeader>Borders</SectionHeader>
							<CheckboxRow
								label="Show borders"
								checked={localChartSettings.candles.borderVisible}
								onChange={(c) => updateLocal('candles.borderVisible', c)}
							/>
							<ColorRow
								label="Bullish"
								value={localChartSettings.candles.borderUpColor}
								onChange={(v) => updateLocal('candles.borderUpColor', v)}
							/>
							<ColorRow
								label="Bearish"
								value={localChartSettings.candles.borderDownColor}
								onChange={(v) => updateLocal('candles.borderDownColor', v)}
							/>
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
