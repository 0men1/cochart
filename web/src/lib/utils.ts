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

export const getApiBaseUrl = () => process.env.NEXT_PUBLIC_API_URL ?? '';
export const getBaseSocketUrl = () => {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api) return api.replace(/^http/, 'ws'); // https->wss, http->ws
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
};
