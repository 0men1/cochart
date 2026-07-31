import { logger } from "@cochart/protocol";
import type { SuggestionData, SuggestionType } from "./validate";

// Maps each suggestion type to the GitHub issue title prefix and label applied
// when the issue is created.
const TYPE_META: Record<SuggestionType, { prefix: string; label: string }> = {
  bug: { prefix: "Bug", label: "bug" },
  improvement: { prefix: "Improvement", label: "enhancement" },
  other: { prefix: "Suggestion", label: "suggestion" },
};

export interface GithubIssue {
  title: string;
  body: string;
  labels: string[];
}

/**
 * Pure mapping from a validated suggestion to a GitHub issue payload. No I/O so
 * it can be unit tested. The first line of the message becomes the title;
 * contact (if provided) is appended to the body.
 */
export function buildIssue(data: SuggestionData): GithubIssue {
  const meta = TYPE_META[data.type];
  const firstLine = data.message.split("\n")[0].trim();
  const summary = firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;

  const bodyParts = [data.message.trim(), "", "---", "_Submitted via the in-app suggestion form._"];
  if (data.contact) {
    bodyParts.push(`Contact: ${data.contact}`);
  }

  return {
    title: `[${meta.prefix}] ${summary}`,
    body: bodyParts.join("\n"),
    labels: ["suggestion", meta.label].filter((l, i, a) => a.indexOf(l) === i),
  };
}

export interface CreateIssueResult {
  ok: boolean;
  /** HTML url of the created issue, present on success. */
  url?: string;
  /** Set when the server is not configured with a token. */
  unconfigured?: boolean;
}

const GITHUB_API_VERSION = "2022-11-28";

/**
 * Creates the issue on GitHub via the REST API using a server-side token.
 * Returns `{ ok: false, unconfigured: true }` when no token is set so the route
 * can respond with a friendly "temporarily unavailable" instead of failing.
 */
export async function createGithubIssue(
  issue: GithubIssue,
): Promise<CreateIssueResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logger.warn("GITHUB_TOKEN is not set; suggestion endpoint is disabled");
    return { ok: false, unconfigured: true };
  }

  const repo = process.env.GITHUB_REPO || "0men1/cochart";

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "Content-Type": "application/json",
        "User-Agent": "cochart-suggestions",
      },
      body: JSON.stringify(issue),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error(`GitHub issue creation failed (${res.status}): ${text}`);
      return { ok: false };
    }

    const json = (await res.json()) as { html_url?: string };
    return { ok: true, url: json.html_url };
  } catch (err) {
    logger.error("GitHub issue creation error:", err);
    return { ok: false };
  }
}
