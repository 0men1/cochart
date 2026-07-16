'use client'

import { Loader2, WifiOff } from 'lucide-react';
import { useCollabStore } from '@/stores/useCollabStore';
import { ConnectionStatus } from '@/core/chart/market-data/types';

export default function ConnectionBanner() {
  const status = useCollabStore((s) => s.status);
  const roomId = useCollabStore((s) => s.roomId);

  if (!roomId) return null;

  if (status === ConnectionStatus.RECONNECTING) {
    return (
      <Banner className="bg-card/95 text-foreground border-border">
        <Loader2 size={14} className="animate-spin text-live" />
        Reconnecting…
      </Banner>
    );
  }

  if (status === ConnectionStatus.ERROR) {
    return (
      <Banner className="bg-destructive/10 text-destructive border-destructive/30">
        <WifiOff size={14} />
        Connection lost — retrying
      </Banner>
    );
  }

  return null;
}

function Banner({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm ${className ?? ''}`}
      >
        {children}
      </div>
    </div>
  );
}
