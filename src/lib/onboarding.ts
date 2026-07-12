// First-run onboarding flag. Persisted per browser (localStorage) so the
// welcome tour auto-shows only once for a new visitor. Mirrors the anonymous
// identity model in `identity.ts`; nothing is sent to the server.

import { LocalStorage } from "./localStorage";

const STORAGE_KEY = "cochart:onboarding";

/** True once the visitor has dismissed the welcome tour at least once. */
export function hasSeenIntro(): boolean {
	return LocalStorage.getItem<{ seen?: boolean }>(STORAGE_KEY)?.seen === true;
}

/** Records that the visitor has seen the welcome tour. */
export function markIntroSeen(): void {
	LocalStorage.setItem(STORAGE_KEY, { seen: true });
}
