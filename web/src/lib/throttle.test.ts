import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { throttle } from "./throttle";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("throttle", () => {
	it("invokes on the leading edge immediately", () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 100);

		throttled("a");
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenLastCalledWith("a");
	});

	it("suppresses calls within the window and fires the last one on the trailing edge", () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 100);

		throttled("a"); // leading
		throttled("b"); // suppressed
		throttled("c"); // suppressed, becomes the trailing call
		expect(fn).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith("c");
	});

	it("allows another leading call once the window has elapsed", () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 100);

		throttled("a");
		vi.advanceTimersByTime(100);

		throttled("b");
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith("b");
	});

	it("cancel() drops the pending trailing call", () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 100);

		throttled("a"); // leading
		throttled("b"); // pending trailing
		throttled.cancel();

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
