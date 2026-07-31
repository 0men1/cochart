import { create } from "zustand";
import { CollabAction, ChatMessage } from "./types";
import { useCollabStore } from "./useCollabStore";

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  unread: number;
  toggle: (isOpen: boolean) => void;
  // A message arrived from the server (including our own, echoed back).
  receive: (message: ChatMessage) => void;
  // Replace the whole history, e.g. from a room snapshot on join.
  setMessages: (messages: ChatMessage[]) => void;
  // Send text to the room; the server stamps identity and broadcasts it back.
  sendMessage: (text: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  unread: 0,
  toggle: (isOpen: boolean) =>
    set({ isOpen, unread: isOpen ? 0 : get().unread }),
  receive: (message: ChatMessage) =>
    set((state) => ({
      messages: [...state.messages, message],
      unread: state.isOpen ? 0 : state.unread + 1,
    })),
  setMessages: (messages: ChatMessage[]) => set({ messages }),
  sendMessage: (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = useCollabStore.getState().socket;
    if (!socket) return;
    socket.send({
      type: CollabAction.CHAT,
      payload: { text: trimmed },
    });
  },
  reset: () => set({ isOpen: false, messages: [], unread: 0 }),
}));
