"use client"

import { useState, useEffect, useRef } from "react";
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
	const [query, setQuery] = useState(state.tickerSearchBox.searchTerm);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [cursor, setCursor] = useState(0);

	const inputRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<SearchResult[]>([]);
	const cursorRef = useRef(0);

	useEffect(() => {
		resultsRef.current = results;
		cursorRef.current = cursor;
	}, [results, cursor]);

	const handleSelect = (item: SearchResult) => {
		action.toggleTickerSearchBox(false);
		action.selectChart({
			symbol: item.ID,
			name: item.Name,
			exchange: item.Exchange
		}, state.chart.data.timeframe);
	};

	useEffect(() => {
		if (!state.tickerSearchBox.isOpen) {
			setQuery("");
			setResults([]);
			setCursor(0);
		} else {
			const term = state.tickerSearchBox.searchTerm;
			setQuery(term);

			setTimeout(() => {
				if (inputRef.current) {
					inputRef.current.focus();
					if (term.length > 1) {
						inputRef.current.select();
					} else {
						const len = inputRef.current.value.length;
						inputRef.current.setSelectionRange(len, len);
					}
				}
			}, 0);
		}
	}, [state.tickerSearchBox.isOpen, state.tickerSearchBox.searchTerm]);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			const currentResults = resultsRef.current;
			const currentCursor = cursorRef.current;

			if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
				e.preventDefault();
			}

			switch (e.key) {
				case "Escape":
					action.toggleTickerSearchBox(false);
					break;
				case "Enter":
					if (currentResults.length > 0) {
						handleSelect(currentResults[currentCursor]);
					}
					break;
				case "ArrowUp":
					if (currentResults.length > 0) {
						setCursor((prev) => (prev - 1 + currentResults.length) % currentResults.length);
					}
					break;
				case "ArrowDown":
					if (currentResults.length > 0) {
						setCursor((prev) => (prev + 1) % currentResults.length);
					}
					break;
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [action]);

	useEffect(() => {
		const controller = new AbortController();
		const signal = controller.signal;

		const timer = setTimeout(async () => {
			if (!query.trim()) {
				setResults([]);
				return;
			}
			setLoading(true);
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&l=20`, { signal });
				if (res.ok) {
					const data = await res.json();
					setResults(data || []);
					setCursor(0);
				}
			} catch (error: any) {
				if (error.name !== 'AbortError') {
					console.error("Search failed", error);
				}
			} finally {
				if (!signal.aborted) {
					setLoading(false);
				}
			}
		}, 150);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query]);

	if (!state.tickerSearchBox.isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-[20vh] px-4 bg-black/80 backdrop-blur-sm">
			<div className="absolute inset-0" onClick={() => action.toggleTickerSearchBox(false)}></div>

			<div className="relative z-50 w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

				<div className="flex items-center border-b border-zinc-800 px-3">
					<SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50 text-zinc-400" />
					<input
						ref={inputRef}
						className="flex h-11 w-full rounded-md bg-transparent py-3 text-base md:text-sm outline-none placeholder:text-zinc-500 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
						placeholder="Search ticker (e.g. BTC)..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>

				<div className="max-h-[50vh] md:max-h-[300px] overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
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

					{!loading && results.map((ticker, index) => (
						<div
							key={`${ticker.ID}/${ticker.Exchange}`}
							className={`px-2 py-2 mx-1 rounded cursor-pointer transition-colors duration-100 ${index === cursor ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}
							onMouseEnter={() => setCursor(index)}
							onClick={() => handleSelect(ticker)}
						>
							<TickerSearchItem
								symbol={ticker.ID}
								name={ticker.Name}
								provider={ticker.Exchange}
							/>
						</div>
					))}
				</div>

				<div className="hidden md:block border-t border-zinc-800 bg-zinc-900/50 p-2 px-4">
					<div className="flex justify-end gap-2">
						<span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-medium">
							ESC
						</span>
						<span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-medium">
							↑↓ to navigate
						</span>
						<span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-medium">
							ENTER
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
