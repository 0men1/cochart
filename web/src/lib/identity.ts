// Anonymous, account-free identity. Every visitor is assigned a stable id,
// a friendly display name and a color the first time they open the app. It is
// persisted per browser (localStorage) so refreshes and return visits keep the
// same identity. Nothing is ever sent to or stored on the server as an account.

import { randomUUID } from "./utils";

export interface Identity {
	userId: string;
	displayName: string;
	color: string;
}

const STORAGE_KEY = 'cochart:identity';

const ADJECTIVES = [
	'Swift', 'Calm', 'Bold', 'Bright', 'Keen', 'Lucky',
	'Nimble', 'Sharp', 'Sunny', 'Wise', 'Brave', 'Cool',
];

const ANIMALS = [
	'Falcon', 'Otter', 'Lynx', 'Fox', 'Heron', 'Bison',
	'Wolf', 'Hawk', 'Panda', 'Orca', 'Tiger', 'Crane',
];

// Distinct, readable hues that hold up on both light and dark chrome.
export const IDENTITY_COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
	'#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e',
];

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function createIdentity(): Identity {
	return {
		userId: randomUUID(),
		displayName: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
		color: pick(IDENTITY_COLORS),
	};
}

function isValid(value: unknown): value is Identity {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return typeof v.userId === 'string'
		&& typeof v.displayName === 'string'
		&& typeof v.color === 'string';
}

/**
 * Returns this browser's identity, creating and persisting one on first use.
 * Client-only; callers must run this in the browser.
 */
export function getIdentity(): Identity {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (isValid(parsed)) return parsed;
		}
	} catch {
		// fall through and mint a fresh identity
	}

	const identity = createIdentity();
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
	} catch {
		// non-persistent (e.g. private mode) — identity still works for the session
	}
	return identity;
}

/** Persists partial edits (e.g. a renamed or recolored identity). */
export function saveIdentity(identity: Identity): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
	} catch {
		// ignore write failures
	}
}
