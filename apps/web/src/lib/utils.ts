import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getBaseSocketUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'ws://localhost:8080'
  }
  return 'wss://api.cochart.app'
};
