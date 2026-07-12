import type { ExchangeProvider, Product } from "./types";

// Prefix search over an alphabetically-sorted product index, using a
// lower-bound binary search (port of the Go sort.Search approach).
export class SearchEngine {
	private index: Product[] = [];

	async buildIndex(providers: Map<string, ExchangeProvider>): Promise<void> {
		const agg: Product[] = [];
		for (const provider of providers.values()) {
			try {
				const products = await provider.getProducts();
				agg.push(...products);
			} catch {
				// Skip providers that fail to load, same as the Go version.
				continue;
			}
		}

		agg.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		this.index = agg;
	}

	search(query: string, limit: number): Product[] {
		query = query.toUpperCase();
		if (query === "") return [];

		// Lower bound: first index whose name >= query.
		let lo = 0;
		let hi = this.index.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (this.index[mid].name < query) {
				lo = mid + 1;
			} else {
				hi = mid;
			}
		}

		const results: Product[] = [];
		for (let i = lo; i < this.index.length && results.length < limit; i++) {
			if (!this.index[i].name.startsWith(query)) break;
			results.push(this.index[i]);
		}
		return results;
	}
}
