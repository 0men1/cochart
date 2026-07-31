import { create } from 'zustand';
import { getIdentity, saveIdentity, type Identity } from '@/lib/identity';

interface IdentityState {
	identity: Identity | null;
	// Loads (or mints) this browser's identity. Safe to call repeatedly.
	init: () => void;
	setDisplayName: (displayName: string) => void;
	setColor: (color: string) => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
	identity: null,
	init: () => {
		if (get().identity) return;
		set({ identity: getIdentity() });
	},
	setDisplayName: (displayName: string) => {
		const current = get().identity;
		if (!current) return;
		const next = { ...current, displayName };
		saveIdentity(next);
		set({ identity: next });
	},
	setColor: (color: string) => {
		const current = get().identity;
		if (!current) return;
		const next = { ...current, color };
		saveIdentity(next);
		set({ identity: next });
	},
}));
