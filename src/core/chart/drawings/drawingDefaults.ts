import { DrawingType } from "@/core/chart/types";
import { LocalStorage } from "@/lib/localStorage";
import { BaseOptions } from "./types";

// Remembers the most recently applied style options per drawing type, so a new
// drawing inherits the last look the user chose instead of the class defaults.
// Persisted to localStorage and mirrored in an in-memory cache for cheap reads.

const STORAGE_KEY = "cochart-drawing-defaults";

export type DrawingDefaults = Partial<Record<DrawingType, Partial<BaseOptions>>>;

// Options tied to one specific drawing that must NOT leak onto the next new one
// of the same type (e.g. its label text). Style — color, width, fill, levels —
// is intentionally carried over.
const PER_DRAWING_KEYS: (keyof BaseOptions)[] = ["labelText", "showLabel"];

let cache: DrawingDefaults | null = null;

function read(): DrawingDefaults {
	if (cache === null) {
		cache = LocalStorage.getItem<DrawingDefaults>(STORAGE_KEY) ?? {};
	}
	return cache;
}

// The last-used style options for a drawing type, or undefined if the user has
// never customised one. New drawings merge this over their class defaults.
export function getLastDrawingOptions(
	type: DrawingType,
): Partial<BaseOptions> | undefined {
	return read()[type];
}

// Record the options a user just applied to a drawing as the new default for
// that type. Drawing-specific keys (label text) are stripped first.
export function rememberDrawingOptions(
	type: DrawingType,
	options: Partial<BaseOptions>,
): void {
	const cleaned: Partial<BaseOptions> = { ...options };
	for (const key of PER_DRAWING_KEYS) delete cleaned[key];

	const next: DrawingDefaults = { ...read(), [type]: cleaned };
	cache = next;
	LocalStorage.setItem(STORAGE_KEY, next);
}

// Test seam: drop the in-memory cache so the next read re-hydrates from storage.
export function __resetDrawingDefaultsCache(): void {
	cache = null;
}
