import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_SERVER_DEV_URL
  }
  return process.env.NEXT_PUBLIC_SERVER_URL
};

export const getBaseIP = () => {
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_SERVER_DEV_IP
  }
  return process.env.NEXT_PUBLIC_SERVER_IP
};
