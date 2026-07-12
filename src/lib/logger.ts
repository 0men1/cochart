// Tiny isomorphic logger (works in the browser and in Node). `debug`/`info`
// are silenced in production so dev noise doesn't ship; `warn`/`error` always
// emit. Route all logging through this so there's a single control point.
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
	debug: (...args: unknown[]) => {
		if (isDev) console.debug(...args);
	},
	info: (...args: unknown[]) => {
		if (isDev) console.info(...args);
	},
	warn: (...args: unknown[]) => {
		console.warn(...args);
	},
	error: (...args: unknown[]) => {
		console.error(...args);
	},
};
