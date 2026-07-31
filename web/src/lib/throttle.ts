// Rate-limit a function to at most one call per `ms`, with both a leading edge
// (the first call fires immediately) and a trailing edge (the last suppressed
// call fires when the window closes). Useful for high-frequency events like
// pointer moves where we want the newest value without flooding the network.
export interface Throttled<A extends unknown[]> {
	(...args: A): void;
	// Drops any pending trailing call and resets the window.
	cancel(): void;
}

export function throttle<A extends unknown[]>(
	fn: (...args: A) => void,
	ms: number,
): Throttled<A> {
	let lastCall = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: A | null = null;

	const invoke = (args: A) => {
		lastCall = Date.now();
		lastArgs = null;
		fn(...args);
	};

	const throttled = ((...args: A) => {
		const remaining = ms - (Date.now() - lastCall);
		lastArgs = args;
		if (remaining <= 0) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			invoke(args);
		} else if (!timer) {
			timer = setTimeout(() => {
				timer = null;
				if (lastArgs) invoke(lastArgs);
			}, remaining);
		}
	}) as Throttled<A>;

	throttled.cancel = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		lastCall = 0;
		lastArgs = null;
	};

	return throttled;
}
