import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// `crypto.randomUUID` is only exposed in secure contexts (HTTPS or localhost),
// so it's missing when the app is served over plain HTTP (e.g. hitting a
// droplet by IP). `crypto.getRandomValues` is available even in insecure
// contexts, so fall back to building a v4 UUID from it.
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") + "-" +
    hex.slice(4, 6).join("") + "-" +
    hex.slice(6, 8).join("") + "-" +
    hex.slice(8, 10).join("") + "-" +
    hex.slice(10, 16).join("")
  );
}

// The collab server is a separate process (the `server` workspace). Point the
// socket at it via NEXT_PUBLIC_WS_URL (e.g. ws://localhost:4000) when the app
// and server run on different origins — dev, or a split deployment. When unset
// (same-origin behind a proxy, or the combined case) it falls back to the
// current origin, working in both http/ws and https/wss.
export const getBaseSocketUrl = () => {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
};
