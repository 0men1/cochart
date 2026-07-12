import { useChartStore } from "@/stores/useChartStore";
import { useUIStore } from "@/stores/useUIStore";

interface TickerSearchItemProps {
	symbol: string;
	name: string;
	provider: string;
}

export default function TickerSearchItem({ symbol, name, provider }: TickerSearchItemProps) {
	const { selectChart, data } = useChartStore();
	const { toggleTickerSearch } = useUIStore();

	const onItemClick = () => {
		selectChart({ symbol, name, exchange: provider }, data.timeframe);
		toggleTickerSearch(false);
	}

	return (
		<div className="flex items-center justify-between p-3 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 transition-colors duration-200"
			onClick={onItemClick} >
			<div className="flex flex-col">
				<span className="font-bold text-white text-sm">{symbol}</span>
				<span className="text-zinc-400 text-xs">{name}</span>
			</div>
			<span className="text-emerald-400 font-mono text-sm">{provider}</span>
		</div>
	);
}
