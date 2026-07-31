import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "@cochart/protocol";
import { clientIp, sendJson } from "../http";
import { createGithubIssue, buildIssue } from "./github";
import { createRateLimiter } from "./rateLimit";
import { validateSuggestion } from "./validate";

// 5 submissions per 10 minutes per IP — enough for a legit user who wants to
// file a couple of things, low enough to blunt casual flooding.
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

const MAX_BODY_BYTES = 16 * 1024;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// POST /api/suggestions — anonymous, account-free issue/improvement submission.
export async function handleCreateSuggestion(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!limiter.check(clientIp(req))) {
    sendJson(res, 429, { error: "Too many submissions. Please try again later." });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid request body" });
    return;
  }

  const result = validateSuggestion(body);
  if (!result.ok) {
    // Honeypot tripped: pretend success so bots get no signal, but skip the
    // GitHub call entirely.
    if (result.honeypot) {
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 400, { error: result.error });
    return;
  }

  const created = await createGithubIssue(buildIssue(result.data));
  if (created.unconfigured) {
    sendJson(res, 503, { error: "Suggestions are temporarily unavailable." });
    return;
  }
  if (!created.ok) {
    sendJson(res, 502, { error: "Couldn't submit your suggestion. Please try again." });
    return;
  }

  logger.info("Suggestion submitted:", created.url);
  sendJson(res, 200, { ok: true, url: created.url });
}
