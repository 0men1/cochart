import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
	it("allows up to the limit within a window, then blocks", () => {
		const now = 1000;
		const limiter = createRateLimiter({ limit: 3, windowMs: 100, now: () => now });

		expect(limiter.check("a")).toBe(true);
		expect(limiter.check("a")).toBe(true);
		expect(limiter.check("a")).toBe(true);
		expect(limiter.check("a")).toBe(false);
	});

	it("resets once the window elapses", () => {
		let now = 0;
		const limiter = createRateLimiter({ limit: 1, windowMs: 100, now: () => now });

		expect(limiter.check("a")).toBe(true);
		expect(limiter.check("a")).toBe(false);

		now = 100;
		expect(limiter.check("a")).toBe(true);
	});

	it("tracks keys independently", () => {
		const now = 0;
		const limiter = createRateLimiter({ limit: 1, windowMs: 100, now: () => now });

		expect(limiter.check("a")).toBe(true);
		expect(limiter.check("b")).toBe(true);
		expect(limiter.check("a")).toBe(false);
	});
});
