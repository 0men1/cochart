import { describe, expect, it } from "vitest";
import { planAssignments } from "./pool";

const totalUsers = (plan: ReturnType<typeof planAssignments>) =>
  plan.flat().reduce((n, a) => n + a.users, 0);

const seedCount = (plan: ReturnType<typeof planAssignments>, roomId: string) =>
  plan.flat().filter((a) => a.roomId === roomId && a.seed).length;

describe("planAssignments", () => {
  it("hands out whole rooms round-robin when rooms outnumber workers", () => {
    const plan = planAssignments(["a", "b", "c", "d"], 5, 2);
    expect(plan).toHaveLength(2);
    expect(plan[0].map((a) => a.roomId)).toEqual(["a", "c"]);
    expect(plan[1].map((a) => a.roomId)).toEqual(["b", "d"]);
    expect(totalUsers(plan)).toBe(20);
  });

  it("splits a single room across every worker", () => {
    const plan = planAssignments(["solo"], 100, 4);
    expect(totalUsers(plan)).toBe(100);
    for (const worker of plan) {
      expect(worker[0].users).toBe(25);
    }
  });

  it("spreads an uneven remainder across leading workers instead of piling it on one", () => {
    const plan = planAssignments(["solo"], 10, 4);
    expect(totalUsers(plan)).toBe(10);
    expect(plan.map((w) => w[0].users)).toEqual([3, 3, 2, 2]);
  });

  it("seeds each room exactly once", () => {
    expect(seedCount(planAssignments(["solo"], 100, 4), "solo")).toBe(1);

    const many = planAssignments(["a", "b", "c"], 4, 2);
    for (const roomId of ["a", "b", "c"]) {
      expect(seedCount(many, roomId)).toBe(1);
    }
  });

  it("skips workers that would get zero users rather than emitting empty assignments", () => {
    const plan = planAssignments(["solo"], 2, 5);
    expect(totalUsers(plan)).toBe(2);
    expect(plan.flat()).toHaveLength(2);
    expect(plan.flat().every((a) => a.users > 0)).toBe(true);
  });

  it("returns empty plans for a degenerate level", () => {
    expect(planAssignments([], 10, 3).flat()).toEqual([]);
    expect(planAssignments(["a"], 0, 3).flat()).toEqual([]);
  });
});
