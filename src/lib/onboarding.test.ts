import { describe, it, expect, afterEach, vi } from "vitest";
import { hasSeenIntro, markIntroSeen } from "./onboarding";

// The LocalStorage helper is SSR-guarded (requires `window`). Provide a minimal
// in-memory browser storage so the real read/write path runs under the node env.
function installBrowserStorage() {
	const store = new Map<string, string>();
	vi.stubGlobal("window", {});
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
		clear: () => store.clear(),
	});
}

describe("onboarding intro flag", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("defaults to not seen", () => {
		installBrowserStorage();
		expect(hasSeenIntro()).toBe(false);
	});

	it("reports seen after markIntroSeen (round-trip)", () => {
		installBrowserStorage();
		expect(hasSeenIntro()).toBe(false);
		markIntroSeen();
		expect(hasSeenIntro()).toBe(true);
	});

	it("treats a missing window (SSR) as not seen", () => {
		// No browser storage installed → LocalStorage short-circuits to null.
		expect(hasSeenIntro()).toBe(false);
	});
});
