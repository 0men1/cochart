import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../../lib/logger";
import { clientIp, sendJson } from "../http";
import { candlesLimiter, searchLimiter } from "../index";
import type { SearchEngine } from "./search";
import type { MarketService } from "./service";
import { validateCandleParams, validateSearchParams } from "./validate";

// GET /api/candles?symbol&timeframe&provider&start&end
export async function handleCandles(
  req: IncomingMessage,
  res: ServerResponse,
  service: MarketService,
): Promise<void> {
  if (!candlesLimiter.check(clientIp(req))) {
    sendJson(res, 429, { error: "Too many requests. Please slow down." });
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const result = validateCandleParams(
    url.searchParams,
    new Set(service.getProviders().keys()),
  );
  if (!result.ok) {
    sendJson(res, 400, { error: result.error });
    return;
  }

  const { provider, symbol, start, end, granularity } = result.data;
  try {
    const candles = await service.fetchCandles(
      provider,
      symbol,
      start,
      end,
      granularity,
    );
    sendJson(res, 200, candles);
  } catch (err) {
    logger.error("Fetch error:", err);
    sendJson(res, 500, { error: "Failed to fetch candles" });
  }
}

// GET /api/search?q&l
export function handleSearch(
  req: IncomingMessage,
  res: ServerResponse,
  engine: SearchEngine,
): void {
  if (!searchLimiter.check(clientIp(req))) {
    sendJson(res, 429, { error: "Too many requests. Please slow down." });
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const result = validateSearchParams(url.searchParams);
  if (!result.ok) {
    sendJson(res, 400, { error: result.error });
    return;
  }

  const { q, limit } = result.data;

  // The client expects PascalCase keys (this preserves the Go server's
  // tagless JSON shape — see SearchResult in TickerSearchBox.tsx).
  const products = engine.search(q, limit).map((p) => ({
    ID: p.id,
    Name: p.name,
    Type: p.type,
    Exchange: p.exchange,
  }));

  sendJson(res, 200, products);
}
