import { describe, it, expect } from "vitest";
import { CoinbaseExchange } from "./CoinbaseExchange";

const exchange = new CoinbaseExchange();

describe("CoinbaseExchange.parseTickerMessage", () => {
  it("parses a valid ticker message", () => {
    const tick = exchange.parseTickerMessage({
      type: "ticker",
      product_id: "BTC-USD",
      price: "100.5",
      time: "2025-01-01T00:00:00Z",
      volume_24h: "5",
      last_size: "0.25",
      best_bid: "100",
      best_ask: "101",
    });
    expect(tick).toEqual({
      symbol: "BTC-USD",
      price: 100.5,
      timestamp: Math.floor(Date.parse("2025-01-01T00:00:00Z") / 1000),
      volume: 5,
      size: 0.25,
      bid: 100,
      ask: 101,
    });
  });

  it("leaves optional fields undefined when absent", () => {
    const tick = exchange.parseTickerMessage({
      type: "ticker",
      product_id: "ETH-USD",
      price: "42",
    });
    expect(tick?.symbol).toBe("ETH-USD");
    expect(tick?.price).toBe(42);
    expect(tick?.volume).toBeUndefined();
    expect(tick?.size).toBeUndefined();
    expect(tick?.bid).toBeUndefined();
    expect(tick?.ask).toBeUndefined();
    expect(typeof tick?.timestamp).toBe("number");
  });

  it("returns null for non-ticker or incomplete messages", () => {
    expect(exchange.parseTickerMessage({ type: "heartbeat", price: "1", product_id: "X" })).toBeNull();
    expect(exchange.parseTickerMessage({ type: "ticker", product_id: "X" })).toBeNull(); // no price
    expect(exchange.parseTickerMessage({ type: "ticker", price: "1" })).toBeNull(); // no product_id
  });
});

describe("CoinbaseExchange subscribe/unsubscribe payloads", () => {
  it("formats a subscribe message", () => {
    expect(exchange.formatSubscribeMessage(["BTC-USD", "ETH-USD"])).toEqual({
      type: "subscribe",
      product_ids: ["BTC-USD", "ETH-USD"],
      channels: ["ticker"],
    });
  });

  it("formats an unsubscribe message", () => {
    expect(exchange.formatUnsubscribeMessage(["BTC-USD"])).toEqual({
      type: "unsubscribe",
      product_ids: ["BTC-USD"],
      channels: ["ticker"],
    });
  });

  it("handles an empty symbol list", () => {
    expect(exchange.formatSubscribeMessage([]).product_ids).toEqual([]);
  });
});
