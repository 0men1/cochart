import { describe, it, expect, beforeEach } from "vitest";
import type { Time } from "cochart-charts";
import {
  snapTimeToInterval,
  setActiveIntervalSeconds,
  getActiveIntervalSeconds,
} from "./interval";

beforeEach(() => {
  setActiveIntervalSeconds(60);
});

describe("snapTimeToInterval", () => {
  it("floors a timestamp to its interval bucket", () => {
    expect(snapTimeToInterval(125 as Time, 60)).toBe(120);
    expect(snapTimeToInterval(120 as Time, 60)).toBe(120);
    expect(snapTimeToInterval(0 as Time, 60)).toBe(0);
  });

  it("uses the active interval by default", () => {
    setActiveIntervalSeconds(300);
    expect(snapTimeToInterval(650 as Time)).toBe(600);
  });

  it("returns non-numeric times unchanged", () => {
    const businessDay = { year: 2020, month: 1, day: 1 } as unknown as Time;
    expect(snapTimeToInterval(businessDay)).toBe(businessDay);
  });

  it("returns the time unchanged for a non-positive interval", () => {
    expect(snapTimeToInterval(125 as Time, 0)).toBe(125);
  });
});

describe("active interval state", () => {
  it("updates on a positive value", () => {
    setActiveIntervalSeconds(900);
    expect(getActiveIntervalSeconds()).toBe(900);
  });

  it("ignores non-positive values", () => {
    setActiveIntervalSeconds(300);
    setActiveIntervalSeconds(0);
    setActiveIntervalSeconds(-5);
    expect(getActiveIntervalSeconds()).toBe(300);
  });
});
