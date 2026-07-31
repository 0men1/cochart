// Validation for anonymous suggestion submissions. Kept pure (no I/O) so the
// rules are unit-testable and reused verbatim by the route handler.

export const SUGGESTION_TYPES = ["bug", "improvement", "other"] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;
export const CONTACT_MAX = 200;

export interface SuggestionData {
  type: SuggestionType;
  message: string;
  contact?: string;
}

export type ValidateResult =
  | { ok: true; data: SuggestionData }
  // `honeypot: true` means a bot filled the hidden field. Callers should
  // pretend success rather than reveal the trap.
  | { ok: false; honeypot: true }
  | { ok: false; honeypot?: false; error: string };

function isType(value: unknown): value is SuggestionType {
  return (
    typeof value === "string" &&
    (SUGGESTION_TYPES as readonly string[]).includes(value)
  );
}

export function validateSuggestion(raw: unknown): ValidateResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request body" };
  }
  const body = raw as Record<string, unknown>;

  // Honeypot: a hidden field named `website` that real users never see. Any
  // non-empty value means an automated submission.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return { ok: false, honeypot: true };
  }

  if (!isType(body.type)) {
    return { ok: false, error: "Invalid suggestion type" };
  }

  if (typeof body.message !== "string") {
    return { ok: false, error: "Message is required" };
  }
  const message = body.message.trim();
  if (message.length < MESSAGE_MIN) {
    return { ok: false, error: `Message must be at least ${MESSAGE_MIN} characters` };
  }
  if (message.length > MESSAGE_MAX) {
    return { ok: false, error: `Message must be at most ${MESSAGE_MAX} characters` };
  }

  let contact: string | undefined;
  if (body.contact !== undefined && body.contact !== null && body.contact !== "") {
    if (typeof body.contact !== "string") {
      return { ok: false, error: "Invalid contact" };
    }
    contact = body.contact.trim();
    if (contact.length > CONTACT_MAX) {
      return { ok: false, error: `Contact must be at most ${CONTACT_MAX} characters` };
    }
    if (contact === "") contact = undefined;
  }

  return { ok: true, data: { type: body.type, message, contact } };
}
