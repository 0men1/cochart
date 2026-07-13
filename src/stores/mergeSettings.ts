type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges `override` onto `base`, using `base` as the source of
 * truth for shape. The result always has exactly the keys present in `base`:
 *
 * - nested plain objects are merged key by key,
 * - a key present in `override` wins over `base`,
 * - a key missing from `override` (e.g. a newly added setting that isn't in a
 *   user's persisted state) falls back to the `base` default,
 * - keys present only in `override` (stale/removed settings) are dropped.
 *
 * This lets us extend the persisted `ChartSettings` shape without breaking
 * users whose localStorage predates the new fields.
 */
export function deepMerge<T>(base: T, override: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(override)) {
		return override === undefined ? base : (override as T);
	}

	const result: PlainObject = { ...base };
	for (const key of Object.keys(base)) {
		if (key in override) {
			result[key] = deepMerge(base[key], override[key]);
		}
	}
	return result as T;
}
