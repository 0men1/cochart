export class LocalStorage {
	static getItem<T>(key: string): T | null {
		if (typeof window === 'undefined') {
			return null;
		}

		try {
			const value = localStorage.getItem(key);
			return value ? JSON.parse(value) : null;
		} catch (error) {
			console.error(`[LocalStorage] JSON Parse error for key ${key}:`, error);
			return null;
		}
	}

	static setItem(key: string, value: any): void {
		if (typeof window === 'undefined') return;

		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			console.error("error: failed to set item in localStorage", error);
		}
	}

	removeItem(key: string) {
		try {
			localStorage.removeItem(key);
		} catch (error) {
			console.error("error: failed to remove item from localStorage, ", error)
		}
	}

	clear() {
		try {
			localStorage.clear();
		} catch (error) {
			console.error("error: failed to clear localStorage, ", error)
		}
	}
}
