"use client"

import { useApp } from "./context"
import TickerSearchItem from "./TickerSearchItem";

const DUMMY_TICKERS = [
    { symbol: "BTC-USD", provider: "coinbase", name: "Bitcoin" },
    { symbol: "SOL-USD", provider: "coinbase", name: "Solana" },
    { symbol: "ETH-USD", provider: "coinbase", name: "Ethereum" },
];

export default function TickerSearchBox() {
    const { state, action } = useApp();

    if (!state.tickerSearchBox.isOpen) {
        return null;
    }

    const handleClose = () => {
        action.toggleTickerSearchBox(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={handleClose}></div>
            <div className="relative z-10 w-96 h-[36rem] max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-700 bg-zinc-900">
                    <input
                        type="text"
                        placeholder="Search ticker..."
                        className="w-full bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-600 focus:outline-none focus:border-blue-500"
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {DUMMY_TICKERS.map((ticker) => (
                        <TickerSearchItem
                            key={ticker.symbol}
                            symbol={ticker.symbol}
                            name={ticker.name}
                            provider={ticker.provider}
                        />
                    ))}
                    <div className="h-4"></div>
                </div>

                <div className="p-2 bg-zinc-950 border-t border-zinc-800 text-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Press ESC to close
                    </span>
                </div>
            </div>
        </div>
    )
}
