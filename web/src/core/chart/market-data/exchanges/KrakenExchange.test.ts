import { describe, it, expect } from "vitest";
import { KrakenExchange } from "./KrakenExchange";

const exchange = new KrakenExchange();

// A Kraken v1 ticker frame: [channelID, payload, "ticker", pair].
const tickerFrame = (pair: string, payload: object) => [42, payload, "ticker", pair];

describe("KrakenExchange.parseTickerMessage", () => {
  it("parses a v1 ticker frame", () => {
    const tick = exchange.parseTickerMessage(
      tickerFrame("XBT/USD", {
        a: ["101.0", 2, "2.0"],
        b: ["100.0", 1, "1.0"],
        c: ["100.5", "0.25"],
        v: ["10.0", "5.0"],
      }),
    );
    expect(tick).toEqual({
      symbol: "XBT/USD",
      price: 100.5,
      timestamp: expect.any(Number),
      volume: 5, // 24h = v[1]
      size: 0.25, // last lot volume = c[1]
      bid: 100,
      ask: 101,
    });
  });

  it("returns null for status/heartbeat/subscription frames and non-ticker arrays", () => {
    expect(exchange.parseTickerMessage({ event: "heartbeat" })).toBeNull();
    expect(exchange.parseTickerMessage({ event: "systemStatus", status: "online" })).toBeNull();
    expect(exchange.parseTickerMessage({ event: "subscriptionStatus", pair: "XBT/USD" })).toBeNull();
    expect(exchange.parseTickerMessage([42, {}, "spread", "XBT/USD"])).toBeNull(); // wrong channel
    expect(exchange.parseTickerMessage([42, {}, "ticker", "XBT/USD"])).toBeNull(); // no c
  });
});

describe("KrakenExchange subscribe/unsubscribe payloads", () => {
  it("formats a v1 subscribe message on the ticker channel", () => {
    expect(exchange.formatSubscribeMessage(["XBT/USD", "ETH/USD"])).toEqual({
      event: "subscribe",
      pair: ["XBT/USD", "ETH/USD"],
      subscription: { name: "ticker" },
    });
  });

  it("formats a v1 unsubscribe message", () => {
    expect(exchange.formatUnsubscribeMessage(["XBT/USD"])).toEqual({
      event: "unsubscribe",
      pair: ["XBT/USD"],
      subscription: { name: "ticker" },
    });
  });
});
