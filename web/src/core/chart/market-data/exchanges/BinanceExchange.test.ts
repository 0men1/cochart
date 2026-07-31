import { describe, it, expect } from "vitest";
import { BinanceExchange } from "./BinanceExchange";

const exchange = new BinanceExchange();

describe("BinanceExchange.parseTickerMessage", () => {
  it("parses a 24hrTicker frame", () => {
    const tick = exchange.parseTickerMessage({
      e: "24hrTicker",
      E: 1735689600000,
      s: "BTCUSDT",
      c: "100.5",
      b: "100",
      a: "101",
      v: "5",
      Q: "0.25",
    });
    expect(tick).toEqual({
      symbol: "BTCUSDT",
      price: 100.5,
      timestamp: 1735689600, // ms -> s
      volume: 5,
      size: 0.25,
      bid: 100,
      ask: 101,
    });
  });

  it("returns null for non-ticker or ack frames", () => {
    expect(exchange.parseTickerMessage({ result: null, id: 1 })).toBeNull();
    expect(exchange.parseTickerMessage({ e: "trade", s: "BTCUSDT", c: "1" })).toBeNull();
    expect(exchange.parseTickerMessage({ e: "24hrTicker", s: "BTCUSDT" })).toBeNull(); // no price
    expect(exchange.parseTickerMessage({ e: "24hrTicker", c: "1" })).toBeNull(); // no symbol
  });
});

describe("BinanceExchange subscribe/unsubscribe payloads", () => {
  it("formats a subscribe message with lowercased @ticker streams and an id", () => {
    const msg = exchange.formatSubscribeMessage(["BTCUSDT", "ETHUSDT"]);
    expect(msg.method).toBe("SUBSCRIBE");
    expect(msg.params).toEqual(["btcusdt@ticker", "ethusdt@ticker"]);
    expect(typeof msg.id).toBe("number");
  });

  it("formats an unsubscribe message and advances the id", () => {
    const first = exchange.formatSubscribeMessage(["BTCUSDT"]);
    const second = exchange.formatUnsubscribeMessage(["BTCUSDT"]);
    expect(second.method).toBe("UNSUBSCRIBE");
    expect(second.params).toEqual(["btcusdt@ticker"]);
    expect(second.id).toBeGreaterThan(first.id);
  });
});
