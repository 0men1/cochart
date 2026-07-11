'use client'

import { useCollabStore } from "@/stores/useCollabStore";
import { Button } from "@/components/ui/button";

/**
 * Shown when a room snapshot arrives while the user still has drawings on
 * their chart. The snapshot is held in useCollabStore.pendingSnapshot until
 * the user decides; incoming room deltas keep updating the pending payload.
 */
export default function SnapshotPrompt() {
  const pendingSnapshot = useCollabStore((s) => s.pendingSnapshot);
  const resolvePendingSnapshot = useCollabStore((s) => s.resolvePendingSnapshot);

  if (!pendingSnapshot || pendingSnapshot.awaitingLocalCheck) return null;

  return (
    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-20">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md">
        <div className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
          This room already has a chart
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          What should happen to your current drawings? Kept drawings stay on
          your screen only — they aren&apos;t shared with the room or saved.
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => resolvePendingSnapshot('keep')}>
            Keep mine too
          </Button>
          <Button onClick={() => resolvePendingSnapshot('replace')}>
            Replace with room drawings
          </Button>
        </div>
      </div>
    </div>
  );
}
