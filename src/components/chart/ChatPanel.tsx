'use client'

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useCollabStore } from '@/stores/useCollabStore';
import { useIdentityStore } from '@/stores/useIdentityStore';
import { useChatStore } from '@/stores/useChatStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Bottom-right floating room chat: a launcher button that toggles a panel of
 * messages, each tagged with the sender's presence color + name. Only rendered
 * while connected to a room; renders panel-then-button so, inside the parent
 * flex column, the button stays pinned to the corner and the panel stacks up.
 */
export default function ChatPanel() {
	const roomId = useCollabStore((s) => s.roomId);
	const myId = useIdentityStore((s) => s.identity?.userId);
	const isOpen = useChatStore((s) => s.isOpen);
	const unread = useChatStore((s) => s.unread);
	const messages = useChatStore((s) => s.messages);
	const toggle = useChatStore((s) => s.toggle);
	const sendMessage = useChatStore((s) => s.sendMessage);

	const [draft, setDraft] = useState('');
	const bottomRef = useRef<HTMLDivElement>(null);

	// Keep the latest message in view as history grows or the panel opens.
	useEffect(() => {
		if (isOpen) bottomRef.current?.scrollIntoView({ block: 'end' });
	}, [messages.length, isOpen]);

	if (!roomId) return null;

	const submit = () => {
		if (!draft.trim()) return;
		sendMessage(draft);
		setDraft('');
	};

	return (
		<>
			{isOpen && (
				<div className="flex w-72 max-h-[60vh] flex-col overflow-hidden rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-lg">
					<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">
						<span className="flex items-center gap-2">
							<MessageCircle size={14} className="text-live" />
							Room chat
						</span>
						<button
							onClick={() => toggle(false)}
							className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
							aria-label="Close chat"
						>
							<X size={14} />
						</button>
					</div>

					<div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2">
						{messages.length === 0 ? (
							<p className="text-xs text-muted-foreground py-4 text-center">
								No messages yet. Say hi 👋
							</p>
						) : (
							messages.map((msg) => (
								<div key={msg.id} className="text-sm">
									<span className="mr-1.5 font-semibold" style={{ color: msg.color }}>
										{msg.displayName}
										{msg.userId === myId && (
											<span className="font-normal text-muted-foreground"> (you)</span>
										)}
									</span>
									<span className="text-foreground break-words">{msg.text}</span>
								</div>
							))
						)}
						<div ref={bottomRef} />
					</div>

					<div className="flex items-center gap-2 border-t border-border p-2">
						<Input
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									submit();
								}
							}}
							placeholder="Type a message…"
							maxLength={500}
							className="flex-1"
						/>
						<Button
							size="icon"
							onClick={submit}
							disabled={!draft.trim()}
							aria-label="Send message"
						>
							<Send size={16} />
						</Button>
					</div>
				</div>
			)}

			<button
				onClick={() => toggle(!isOpen)}
				className={cn(
					'relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/95 backdrop-blur-sm shadow-lg text-foreground hover:bg-muted transition-colors',
					isOpen && 'text-live',
				)}
				aria-label={isOpen ? 'Close chat' : 'Open chat'}
			>
				<MessageCircle size={20} />
				{!isOpen && unread > 0 && (
					<span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-live px-1 text-[11px] font-semibold text-white">
						{unread > 99 ? '99+' : unread}
					</span>
				)}
			</button>
		</>
	);
}
