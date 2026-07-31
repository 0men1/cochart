import { describe, it, expect } from "vitest";
import { krakenInterval, parseKrakenOHLC } from "./kraken";

describe("krakenInterval", () => {
  it("maps supported granularities to Kraken minutes", () => {
    expect(krakenInterval(60)).toBe(1);
    expect(krakenInterval(300)).toBe(5);
    expect(krakenInterval(900)).toBe(15);
    expect(krakenInterval(3600)).toBe(60);
    expect(krakenInterval(86400)).toBe(1440);
  });

  it("returns null for 6H (Kraken has no 6H bucket) and other unsupported values", () => {
    expect(krakenInterval(21600)).toBeNull();
    expect(krakenInterval(120)).toBeNull();
  });
});

describe("parseKrakenOHLC", () => {
  it("parses rows honoring Kraken's O/H/L/C order and volume at index 6", () => {
    // [time, open, high, low, close, vwap, volume, count]
    const candles = parseKrakenOHLC({
      result: {
        XXBTZUSD: [
          ["1700000000", "1", "3", "0.5", "2", "1.9", "10", 4],
          ["1700000060", "2", "4", "1.5", "3", "2.9", "20", 6],
        ],
        last: 1700000060,
      },
    });
    expect(candles).toEqual([
      { time: 1700000000, open: 1, high: 3, low: 0.5, close: 2, volume: 10 },
      { time: 1700000060, open: 2, high: 4, low: 1.5, close: 3, volume: 20 },
    ]);
  });

  it("ignores the `last` cursor key and returns [] when there is no data key", () => {
    expect(parseKrakenOHLC({ result: { last: 123 } })).toEqual([]);
  });

  it("throws when the response carries an error", () => {
    expect(() =>
      parseKrakenOHLC({ error: ["EQuery:Unknown asset pair"], result: {} }),
    ).toThrow(/Unknown asset pair/);
  });

  it("sorts candles ascending by time", () => {
    const candles = parseKrakenOHLC({
      result: {
        XXBTZUSD: [
          ["1700000060", "2", "4", "1.5", "3", "2.9", "20", 6],
          ["1700000000", "1", "3", "0.5", "2", "1.9", "10", 4],
        ],
      },
    });
    expect(candles.map((c) => c.time)).toEqual([1700000000, 1700000060]);
  });
});
