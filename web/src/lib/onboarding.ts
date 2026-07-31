import { LocalStorage } from "./localStorage";
const STORAGE_KEY = "cochart:onboarding";
export function hasSeenIntro(): boolean {
  return LocalStorage.getItem<{ seen?: boolean }>(STORAGE_KEY)?.seen === true;
}
export function markIntroSeen(): void {
  LocalStorage.setItem(STORAGE_KEY, { seen: true });
}
