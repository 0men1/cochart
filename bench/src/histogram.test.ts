import { describe, expect, it } from "vitest";
import {
  BUCKET_COUNT,
  Histogram,
  OVERFLOW_INDEX,
  bucketIndex,
  bucketUpperBound,
} from "./histogram";

describe("bucketIndex", () => {
  it("uses 1ms buckets below 1s", () => {
    expect(bucketIndex(0)).toBe(0);
    expect(bucketIndex(0.4)).toBe(0);
    expect(bucketIndex(1)).toBe(1);
    expect(bucketIndex(999.9)).toBe(999);
  });

  it("uses 10ms buckets between 1s and 10s", () => {
    expect(bucketIndex(1000)).toBe(1000);
    expect(bucketIndex(1009)).toBe(1000);
    expect(bucketIndex(1010)).toBe(1001);
    expect(bucketIndex(9999)).toBe(OVERFLOW_INDEX - 1);
  });

  it("collapses everything at or above 10s into the overflow bucket", () => {
    expect(bucketIndex(10_000)).toBe(OVERFLOW_INDEX);
    expect(bucketIndex(60_000)).toBe(OVERFLOW_INDEX);
  });

  it("clamps negatives and NaN to the first bucket rather than writing out of bounds", () => {
    expect(bucketIndex(-5)).toBe(0);
    expect(bucketIndex(Number.NaN)).toBe(0);
  });

  it("never returns an index outside the allocated array", () => {
    for (const ms of [0, 1, 999, 1000, 9999, 10_000, 1e9, -1, Number.NaN]) {
      const i = bucketIndex(ms);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(BUCKET_COUNT);
    }
  });
});

describe("bucketUpperBound", () => {
  it("is monotonic and never below the values it contains", () => {
    for (const ms of [0.5, 12, 500, 1005, 5000, 9995]) {
      expect(bucketUpperBound(bucketIndex(ms))).toBeGreaterThanOrEqual(ms);
    }
  });

  it("is infinite for the overflow bucket", () => {
    expect(bucketUpperBound(OVERFLOW_INDEX)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("Histogram", () => {
  it("reports zeros when empty rather than NaN or Infinity", () => {
    const s = new Histogram().summary();
    expect(s).toEqual({ count: 0, min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });

  it("computes percentiles within one bucket of the true value", () => {
    const h = new Histogram();
    for (let i = 1; i <= 1000; i++) h.record(i);

    expect(h.size).toBe(1000);
    // Nearest-rank ranks for 1..1000 are 500/950/990, and each reported value is
    // that bucket's upper bound — so exactly one millisecond above the rank.
    expect(h.percentile(50)).toBe(501);
    expect(h.percentile(95)).toBe(951);
    expect(h.percentile(99)).toBe(991);
    expect(h.summary().max).toBe(1000);
    expect(h.summary().mean).toBeCloseTo(500.5, 5);
  });

  it("never reports a percentile above the observed maximum", () => {
    const h = new Histogram();
    // Lands mid-way through a coarse bucket whose upper bound (1010) overshoots.
    h.record(1001);
    expect(h.percentile(99)).toBe(1001);
    expect(h.summary().max).toBe(1001);
  });

  it("merges bucket-wise so percentiles match a single combined histogram", () => {
    const a = new Histogram();
    const b = new Histogram();
    const combined = new Histogram();

    for (let i = 1; i <= 500; i++) {
      a.record(i);
      combined.record(i);
    }
    for (let i = 501; i <= 1000; i++) {
      b.record(i);
      combined.record(i);
    }

    const merged = new Histogram();
    merged.merge(a.toData());
    merged.merge(b.toData());

    expect(merged.size).toBe(combined.size);
    expect(merged.summary()).toEqual(combined.summary());
  });

  it("keeps exact min and max across a merge", () => {
    const a = new Histogram();
    const b = new Histogram();
    a.record(3.5);
    b.record(8_000);

    const merged = new Histogram();
    merged.merge(a.toData());
    merged.merge(b.toData());

    expect(merged.summary().min).toBe(3.5);
    expect(merged.summary().max).toBe(8_000);
  });

  it("ignores an empty histogram's sentinel min when merging", () => {
    const populated = new Histogram();
    populated.record(42);

    const merged = new Histogram();
    merged.merge(new Histogram().toData()); // empty: min is +Infinity
    merged.merge(populated.toData());

    expect(merged.summary().min).toBe(42);
  });

  it("clears every field on reset", () => {
    const h = new Histogram();
    h.record(10);
    h.reset();
    expect(h.summary()).toEqual({
      count: 0,
      min: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
    });
  });
});
