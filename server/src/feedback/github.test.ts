import { describe, it, expect } from "vitest";
import { buildIssue } from "./github";

describe("buildIssue", () => {
	it("prefixes the title by type and uses the first message line as summary", () => {
		const issue = buildIssue({ type: "bug", message: "Chart freezes\nmore detail" });
		expect(issue.title).toBe("[Bug] Chart freezes");
		expect(issue.labels).toContain("bug");
		expect(issue.labels).toContain("suggestion");
		expect(issue.body).toContain("Chart freezes");
	});

	it("maps improvement to the enhancement label", () => {
		const issue = buildIssue({ type: "improvement", message: "Add a dark theme toggle" });
		expect(issue.title).toBe("[Improvement] Add a dark theme toggle");
		expect(issue.labels).toContain("enhancement");
	});

	it("truncates a long summary line", () => {
		const issue = buildIssue({ type: "other", message: "x".repeat(200) });
		expect(issue.title.length).toBeLessThanOrEqual("[Suggestion] ".length + 80);
		expect(issue.title.endsWith("...")).toBe(true);
	});

	it("appends contact to the body when provided", () => {
		const issue = buildIssue({ type: "other", message: "hello there", contact: "me@example.com" });
		expect(issue.body).toContain("Contact: me@example.com");
	});

	it("omits contact when absent", () => {
		const issue = buildIssue({ type: "other", message: "hello there" });
		expect(issue.body).not.toContain("Contact:");
	});

	it("de-duplicates labels", () => {
		const issue = buildIssue({ type: "other", message: "hello there" });
		// "other" maps to the "suggestion" label, which also appears as the base
		// label — ensure it isn't listed twice.
		expect(issue.labels).toEqual([...new Set(issue.labels)]);
	});
});
