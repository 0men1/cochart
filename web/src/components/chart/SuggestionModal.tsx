"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/useUIStore";
import { getApiBaseUrl } from "@/lib/utils";

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 4000;

const TYPES = [
  { value: "bug", label: "Bug" },
  { value: "improvement", label: "Improvement" },
  { value: "other", label: "Other" },
] as const;

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; url?: string }
  | { status: "error"; message: string };

export default function SuggestionModal() {
  const isOpen = useUIStore((s) => s.suggestionBox.isOpen);
  const toggleSuggestion = useUIStore((s) => s.toggleSuggestion);

  const [type, setType] = React.useState<(typeof TYPES)[number]["value"]>("improvement");
  const [message, setMessage] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [state, setState] = React.useState<SubmitState>({ status: "idle" });

  const close = React.useCallback(() => toggleSuggestion(false), [toggleSuggestion]);

  // Reset the form whenever the modal is opened fresh.
  React.useEffect(() => {
    if (isOpen) {
      setType("improvement");
      setMessage("");
      setContact("");
      setWebsite("");
      setState({ status: "idle" });
    }
  }, [isOpen]);

  const trimmedLen = message.trim().length;
  const canSubmit =
    state.status !== "submitting" && trimmedLen >= MESSAGE_MIN && trimmedLen <= MESSAGE_MAX;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState({ status: "submitting" });
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, contact: contact || undefined, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setState({
          status: "error",
          message: data.error || "Something went wrong. Please try again.",
        });
        return;
      }
      setState({ status: "success", url: data.url });
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  return (
    <Modal open={isOpen} onClose={close} aria-label="Send a suggestion">
      <div className="flex items-start justify-between p-4 pb-2">
        <div>
          <h2 className="text-base font-semibold">Share feedback</h2>
          <p className="text-xs text-muted-foreground">
            Report a bug or suggest an improvement. No account needed.
          </p>
        </div>
        <ModalClose onClick={close} />
      </div>

      {state.status === "success" ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <CheckCircle2 className="text-live" size={36} />
          <div>
            <p className="font-medium">Thanks for the feedback!</p>
            <p className="text-sm text-muted-foreground">We&apos;ve received your submission.</p>
          </div>
          {state.url && (
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on GitHub <ExternalLink size={14} />
            </a>
          )}
          <Button variant="outline" size="sm" onClick={close} className="mt-2">
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant={type === t.value ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suggestion-message">Message</Label>
            <Textarea
              id="suggestion-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MESSAGE_MAX}
              placeholder="Describe the issue or idea…"
              aria-invalid={trimmedLen > 0 && trimmedLen < MESSAGE_MIN}
            />
            <p className="text-xs text-muted-foreground">
              {trimmedLen < MESSAGE_MIN
                ? `At least ${MESSAGE_MIN} characters.`
                : `${trimmedLen} / ${MESSAGE_MAX}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suggestion-contact">
              Contact <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="suggestion-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder="Email or handle, if you'd like a reply"
            />
          </div>

          {/* Honeypot: hidden from real users, catches bots that fill every field. */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {state.status === "submitting" ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
