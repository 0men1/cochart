import type { IncomingMessage, ServerResponse } from "node:http";
import type { SearchEngine } from "./search";
import type { MarketService } from "./service";

const INTERVALS: Record<string, number> = {
	"1m": 60,
	"5m": 300,
	"15m": 900,
	"1H": 3600,
	"6H": 21600,
	"1D": 86400,
};

// GET /api/candles?symbol&timeframe&provider&start&end
export async function handleCandles(
	req: IncomingMessage,
	res: ServerResponse,
	service: MarketService,
): Promise<void> {
	const url = new URL(req.url ?? "", "http://localhost");
	const symbol = url.searchParams.get("symbol") ?? "";
	const timeframe = url.searchParams.get("timeframe") ?? "";
	const provider = url.searchParams.get("provider") ?? "";

	if (!symbol || !timeframe) {
		res.writeHead(400);
		res.end("Must include symbol/timeframe");
		return;
	}

	const granularity = INTERVALS[timeframe];
	if (!granularity) {
		res.writeHead(400);
		res.end("Unsupported timeframe");
		return;
	}

	const start = parseIntParam(url.searchParams.get("start"));
	const end = parseIntParam(url.searchParams.get("end"));
	if (start === null || end === null) {
		res.writeHead(400);
		res.end("invalid start/end");
		return;
	}

	try {
		const candles = await service.fetchCandles(
			provider,
			symbol,
			start,
			end,
			granularity,
		);
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(candles));
	} catch (err) {
		console.error("Fetch error:", err);
		res.writeHead(500);
		res.end("Failed to fetch candles");
	}
}

// GET /api/search?q&l
export function handleSearch(
	req: IncomingMessage,
	res: ServerResponse,
	engine: SearchEngine,
): void {
	const url = new URL(req.url ?? "", "http://localhost");
	const q = url.searchParams.get("q") ?? "";
	const lParam = url.searchParams.get("l");
	const limit = lParam === null ? Number.NaN : Number.parseInt(lParam, 10);

	if (Number.isNaN(limit)) {
		res.writeHead(400);
		res.end("Invalid limit");
		return;
	}

	if (q === "") {
		res.writeHead(400);
		res.end("Must include query");
		return;
	}

	// The client expects PascalCase keys (this preserves the Go server's
	// tagless JSON shape — see SearchResult in TickerSearchBox.tsx).
	const products = engine.search(q, limit).map((p) => ({
		ID: p.id,
		Name: p.name,
		Type: p.type,
		Exchange: p.exchange,
	}));

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(products));
}

function parseIntParam(value: string | null): number | null {
	if (value === null || value === "") return 0;
	const n = Number.parseInt(value, 10);
	return Number.isNaN(n) ? null : n;
}
