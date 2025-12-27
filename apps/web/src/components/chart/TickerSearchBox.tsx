"use client"

import { useState, useEffect } from "react";
import { useApp } from "./context"
import TickerSearchItem from "./TickerSearchItem";

const SearchIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </svg>
)

const LoaderIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
)

interface SearchResult {
    ID: string;
    Name: string;
    Exchange: string;
    Type: string;
}

export default function TickerSearchBox() {
    const { state, action } = useApp();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Reset on open/close
    useEffect(() => {
        if (!state.tickerSearchBox.isOpen) {
            setQuery("");
            setResults([]);
        }
    }, [state.tickerSearchBox.isOpen]);

    // Handle ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") action.toggleTickerSearchBox(false);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [action]);

    // Search Logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&l=20`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data || []);
                }
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    if (!state.tickerSearchBox.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/80 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => action.toggleTickerSearchBox(false)}></div>

            <div className="relative z-50 w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                <div className="flex items-center border-b border-zinc-800 px-3">
                    <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50 text-zinc-400" />
                    <input
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search ticker (e.g. BTC)..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
                    {loading && (
                        <div className="py-6 text-center text-sm text-zinc-500 flex items-center justify-center gap-2">
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                            Searching...
                        </div>
                    )}

                    {!loading && results.length === 0 && query && (
                        <div className="py-6 text-center text-sm text-zinc-500">
                            No results found.
                        </div>
                    )}

                    {!loading && results.map((ticker) => (
                        <div
                            key={`${ticker.ID}/${ticker.Exchange}`}
                            className="px-2"
                            onClick={() => {
                                // Add selection logic here
                                action.toggleTickerSearchBox(false);
                            }}
                        >
                            <TickerSearchItem
                                symbol={ticker.ID}
                                name={ticker.Name}
                                provider={ticker.Exchange}
                            />
                        </div>
                    ))}
                </div>

                <div className="border-t border-zinc-800 bg-zinc-900/50 p-2 px-4">
                    <div className="flex justify-end gap-2">
                        <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-medium">
                            ESC
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
