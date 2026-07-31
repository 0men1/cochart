"use client"

import { useState, useEffect, useRef } from "react";
import { logger } from "@cochart/protocol";
import { getApiBaseUrl } from "@/lib/utils";
import TickerSearchItem from "./TickerSearchItem";
import { Modal } from "@/components/ui/modal";
import { useUIStore } from "@/stores/useUIStore";
import { useChartStore } from "@/stores/useChartStore";
import { useShallow } from "zustand/react/shallow";

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

interface TickerSearchBoxProps {
	onClose?: () => void;
}

export default function TickerSearchBox({ onClose }: TickerSearchBoxProps) {

	const { tickerSearchBox } = useUIStore();
	const { selectChart, data } = useChartStore(
		useShallow((s) => ({ selectChart: s.selectChart, data: s.data })),
	);

	const [query, setQuery] = useState(tickerSearchBox.searchTerm);
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
		if (onClose) onClose();
		selectChart({
			symbol: item.ID,
			name: item.Name,
			exchange: item.Exchange
		}, data.timeframe);
	};

	useEffect(() => {
		if (!tickerSearchBox.isOpen) {
			setQuery("");
			setResults([]);
			setCursor(0);
		} else {
			const term = tickerSearchBox.searchTerm;
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
	}, [tickerSearchBox.isOpen, tickerSearchBox.searchTerm]);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			const currentResults = resultsRef.current;
			const currentCursor = cursorRef.current;

			if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
				e.preventDefault();
			}

			switch (e.key) {
				case "Escape":
					if (onClose) onClose();
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
	}, []);

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
				const res = await fetch(`${getApiBaseUrl()}/api/search?q=${encodeURIComponent(query)}&l=20`, { signal });
				if (res.ok) {
					const data = await res.json();
					setResults(data || []);
					setCursor(0);
				}
			} catch (error: any) {
				if (error.name !== 'AbortError') {
					logger.error("Search failed", error);
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

	return (
		<Modal
			open={tickerSearchBox.isOpen}
			onClose={() => onClose?.()}
			align="top"
			aria-label="Search ticker"
			className="max-w-lg overflow-hidden p-0"
		>
			<div className="flex items-center border-b border-border px-3">
				<SearchIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
				<input
					ref={inputRef}
					className="flex h-11 w-full rounded-md bg-transparent py-3 text-base md:text-sm outline-none placeholder:text-muted-foreground text-foreground disabled:cursor-not-allowed disabled:opacity-50"
					placeholder="Search ticker (e.g. BTC)..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>

			<div className="max-h-[50vh] md:max-h-[300px] overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
				{loading && (
					<div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
						<LoaderIcon className="h-4 w-4 animate-spin" />
						Searching...
					</div>
				)}

				{!loading && results.length === 0 && query && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						No results found.
					</div>
				)}

				{!loading && results.map((ticker, index) => (
					<div
						key={`${ticker.ID}/${ticker.Exchange}`}
						className={`px-2 py-2 mx-1 rounded-md cursor-pointer transition-colors duration-100 ${index === cursor ? "bg-accent" : "hover:bg-accent/50"}`}
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

			<div className="hidden md:block border-t border-border bg-muted/30 p-2 px-4">
				<div className="flex justify-end gap-2">
					{["ESC", "↑↓ to navigate", "ENTER"].map((hint) => (
						<span key={hint} className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-medium">
							{hint}
						</span>
					))}
				</div>
			</div>
		</Modal>
	)
}
