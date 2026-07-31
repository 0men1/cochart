import { describe, it, expect } from "vitest";
import { validateSuggestion, MESSAGE_MIN, MESSAGE_MAX, CONTACT_MAX } from "./validate";

describe("validateSuggestion", () => {
	const valid = { type: "bug", message: "Something is broken here" };

	it("accepts a well-formed submission and trims the message", () => {
		const result = validateSuggestion({ ...valid, message: "  hello world!  " });
		expect(result).toEqual({ ok: true, data: { type: "bug", message: "hello world!", contact: undefined } });
	});

	it("accepts each valid type", () => {
		for (const type of ["bug", "improvement", "other"]) {
			expect(validateSuggestion({ ...valid, type }).ok).toBe(true);
		}
	});

	it("keeps an optional trimmed contact", () => {
		const result = validateSuggestion({ ...valid, contact: "  me@example.com " });
		expect(result.ok && result.data.contact).toBe("me@example.com");
	});

	it("flags the honeypot without an error message", () => {
		const result = validateSuggestion({ ...valid, website: "http://spam" });
		expect(result).toEqual({ ok: false, honeypot: true });
	});

	it("ignores an empty honeypot", () => {
		expect(validateSuggestion({ ...valid, website: "  " }).ok).toBe(true);
	});

	it("rejects a non-object body", () => {
		expect(validateSuggestion(null).ok).toBe(false);
		expect(validateSuggestion("nope").ok).toBe(false);
	});

	it("rejects an invalid type", () => {
		const result = validateSuggestion({ ...valid, type: "feature" });
		expect(result.ok).toBe(false);
	});

	it("rejects a missing or short message", () => {
		expect(validateSuggestion({ type: "bug" }).ok).toBe(false);
		expect(validateSuggestion({ type: "bug", message: "a".repeat(MESSAGE_MIN - 1) }).ok).toBe(false);
	});

	it("rejects an over-long message", () => {
		expect(validateSuggestion({ type: "bug", message: "a".repeat(MESSAGE_MAX + 1) }).ok).toBe(false);
	});

	it("rejects an over-long contact", () => {
		const result = validateSuggestion({ ...valid, contact: "a".repeat(CONTACT_MAX + 1) });
		expect(result.ok).toBe(false);
	});
});
