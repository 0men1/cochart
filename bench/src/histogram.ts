// Fixed-bucket latency histogram.
//
// Each worker thread keeps its own histogram and ships one compact digest per
// ramp step, rather than posting every individual sample to the main thread —
// at tens of thousands of samples per second the reporting would become the
// harness's own bottleneck and we would end up measuring ourselves.
//
// Fixed buckets are what make that safe: bucket arrays merge by element-wise
// addition, so percentiles over the merged result are exactly what they would
// have been had every sample been recorded centrally. Averaging per-worker
// percentiles (the obvious shortcut) is statistically meaningless.

/** 1 ms resolution below 1 s, 10 ms up to 10 s, then a single overflow bucket. */
const FINE_BUCKETS = 1000; // [0, 1000) ms at 1 ms
const COARSE_BUCKETS = 900; // [1000, 10000) ms at 10 ms
const COARSE_WIDTH_MS = 10;
const COARSE_START_MS = 1000;
export const OVERFLOW_INDEX = FINE_BUCKETS + COARSE_BUCKETS; // 1900
export const BUCKET_COUNT = OVERFLOW_INDEX + 1; // 1901

export function bucketIndex(ms: number): number {
  if (!(ms > 0)) return 0; // also catches NaN
  if (ms < COARSE_START_MS) return Math.floor(ms);
  if (ms < COARSE_START_MS + COARSE_BUCKETS * COARSE_WIDTH_MS) {
    return FINE_BUCKETS + Math.floor((ms - COARSE_START_MS) / COARSE_WIDTH_MS);
  }
  return OVERFLOW_INDEX;
}

/**
 * Inclusive upper bound of a bucket. Percentiles report this rather than a
 * midpoint so a reported value is never optimistic: the true p99 is always
 * at or below what we print.
 */
export function bucketUpperBound(index: number): number {
  if (index < FINE_BUCKETS) return index + 1;
  if (index < OVERFLOW_INDEX) {
    return COARSE_START_MS + (index - FINE_BUCKETS + 1) * COARSE_WIDTH_MS;
  }
  return Number.POSITIVE_INFINITY;
}

/** Structured-cloneable form, for postMessage between worker and main thread. */
export interface HistogramData {
  buckets: Uint32Array;
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface Percentiles {
  count: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export class Histogram {
  private buckets = new Uint32Array(BUCKET_COUNT);
  private count = 0;
  private sum = 0;
  // Tracked exactly rather than read off the buckets, so the extremes stay
  // precise even in the coarse range.
  private min = Number.POSITIVE_INFINITY;
  private max = 0;

  record(ms: number): void {
    this.buckets[bucketIndex(ms)] += 1;
    this.count += 1;
    this.sum += ms;
    if (ms < this.min) this.min = ms;
    if (ms > this.max) this.max = ms;
  }

  merge(other: HistogramData): void {
    for (let i = 0; i < BUCKET_COUNT; i++) this.buckets[i] += other.buckets[i];
    this.count += other.count;
    this.sum += other.sum;
    if (other.count > 0) {
      if (other.min < this.min) this.min = other.min;
      if (other.max > this.max) this.max = other.max;
    }
  }

  get size(): number {
    return this.count;
  }

  toData(): HistogramData {
    return {
      buckets: this.buckets,
      count: this.count,
      sum: this.sum,
      min: this.min,
      max: this.max,
    };
  }

  reset(): void {
    this.buckets.fill(0);
    this.count = 0;
    this.sum = 0;
    this.min = Number.POSITIVE_INFINITY;
    this.max = 0;
  }

  /**
   * Nearest-rank percentile: the smallest bucket whose cumulative count reaches
   * ceil(p/100 * N).
   */
  percentile(p: number): number {
    if (this.count === 0) return 0;
    const target = Math.max(1, Math.ceil((p / 100) * this.count));
    let cumulative = 0;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      cumulative += this.buckets[i];
      if (cumulative >= target) {
        // Never report above the true max — matters in the coarse range, where
        // a bucket's upper bound can overshoot every sample inside it.
        return Math.min(bucketUpperBound(i), this.max);
      }
    }
    return this.max;
  }

  summary(): Percentiles {
    return {
      count: this.count,
      min: this.count === 0 ? 0 : this.min,
      mean: this.count === 0 ? 0 : this.sum / this.count,
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99),
      max: this.max,
    };
  }
}
