'use client'

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Globe, Loader2, LogOut, TriangleAlert, Users } from "lucide-react";
import { useCollabSession } from "./hooks/useCollabSession";
import { useCollabStore } from "@/stores/useCollabStore";
import { useIdentityStore } from "@/stores/useIdentityStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal, ModalClose } from "../ui/modal";

function PrivacyNote({ variant }: { variant: "create" | "share" }) {
  if (variant === "share") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        <TriangleAlert size={14} className="mt-0.5 shrink-0" />
        <p>
          Anyone with this link can view and edit everything here, including
          chat. Don&apos;t share passwords or sensitive info.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground/90">
        <Globe size={14} className="shrink-0" />
        Before you create a room
      </div>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          Anyone with the invite link can join, view, and edit everything —
          your drawings, indicators, and chat.
        </li>
        <li>
          Room contents are stored on the server so the room survives reconnects
          and restarts, and are automatically deleted a few minutes after
          everyone leaves.
        </li>
        <li>
          There are no private rooms — don&apos;t post passwords, personal
          details, or anything sensitive.
        </li>
      </ul>
    </div>
  );
}

export default function CollabStatus() {
  const session = useCollabSession();
  const { isOpen, roomId } = useCollabStore();
  const broadcastPresence = useCollabStore((s) => s.broadcastPresence);
  const identity = useIdentityStore((s) => s.identity);
  const setDisplayName = useIdentityStore((s) => s.setDisplayName);
  const setColor = useIdentityStore((s) => s.setColor);
  const [copied, setCopied] = useState(false);

  // Coalesce rapid name keystrokes / color-picker drags into a single
  // presence broadcast to peers.
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBroadcast = () => {
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    broadcastTimer.current = setTimeout(() => broadcastPresence(), 250);
  };
  useEffect(() => () => {
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
  }, []);

  if (!isOpen) return null;

  const inviteUrl = roomId ? `${window.location.origin}/chart/room/${roomId}` : "";
  const isConnected = !!roomId;

  async function handleCopyUrl() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleNameChange(value: string) {
    setDisplayName(value);
    scheduleBroadcast();
  }

  function handleColorChange(value: string) {
    setColor(value);
    scheduleBroadcast();
  }

  return (
    <Modal open onClose={session.closeWindow} aria-label="Live collaboration" className="p-6">
      {/* Header */}
      <div className="text-center mb-8 relative">
        <ModalClose onClick={session.closeWindow} className="absolute right-0 top-0" />

        <h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
          Live Collaboration
        </h2>

        {isConnected ? (
          <div className="flex items-center justify-center gap-2 text-live text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
            </span>
            <span>Session Active</span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Create a room to trade with others in real-time.
          </p>
        )}
      </div>

      {/* Your identity — editable name + color, persisted locally and, while
			    connected, pushed live to the room's roster. */}
      {identity && (
        <div className="space-y-2 mb-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            You
          </label>
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0" title="Change your color">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-sm text-sm font-semibold text-white transition-transform group-hover:scale-105"
                style={{ backgroundColor: identity.color }}
                aria-hidden
              >
                {identity.displayName.charAt(0).toUpperCase()}
              </div>
              <input
                type="color"
                value={identity.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Your color"
              />
            </div>
            <Input
              value={identity.displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={32}
              placeholder="Your name"
              aria-label="Your display name"
              className="flex-1"
            />
          </div>
        </div>
      )}

      {/* Content */}
      {isConnected ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Invite Link
            </label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 rounded-md bg-muted border border-border font-mono text-xs text-foreground truncate">
                {inviteUrl}
              </div>
              <Button
                onClick={handleCopyUrl}
                className="bg-live text-live-foreground hover:bg-live/90 min-w-[3rem]"
                title="Copy invite link"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            <PrivacyNote variant="share" />
          </div>

          <Button
            variant="ghost"
            onClick={session.leaveSession}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          >
            <LogOut size={16} />
            End Session
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <PrivacyNote variant="create" />
          <Button
            disabled={session.isCreating}
            className="w-full h-12 gap-2"
            onClick={session.createSession}
          >
            {session.isCreating ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Creating Room...
              </>
            ) : (
              <>
                <Users size={18} />
                Create New Room
              </>
            )}
          </Button>

          {session.error && (
            <p className="text-destructive text-xs text-center font-medium">
              {session.error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
