'use client'

import { useRouter } from "next/navigation";
import { useApp } from "@/components/chart/context"

export default function CollabStatus() {
    const { state, action } = useApp();
    const { collaboration } = state
    const router = useRouter();

    if (!collaboration.isOpen) return null;

    async function handleCollabStart() {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/rooms/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (response.ok) {
                const result = await response.json();
                action.createCollabRoom(result.roomId);
                window.history.pushState({}, '', result.url);
            }
        } catch (error) {
            console.error("error: failed to parse response (", error, ")")
        }
    }

    async function handleCollabExit() {
        try {
            action.exitCollabRoom();
            router.replace("/chart")
        } catch (error) {
            console.error("error: failed to parse response (", error, ")");
        }
    }

    async function handleCopyUrl() {
        await navigator.clipboard.writeText(`${window.location.origin}/chart/room/${collaboration.room.id}`);
    }

    const isConnected = collaboration.room.id != null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => action.toggleCollabWindow(false)}
        >
            <div
                className={`border rounded-lg shadow-lg p-8 w-96 max-w-md mx-4 transition-colors ${isConnected
                    ? 'bg-emerald-950/90 border-emerald-500/50'
                    : 'bg-background'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center mb-8">
                    <h2 className={`text-2xl font-semibold mb-2 ${isConnected ? 'text-emerald-100' : 'text-foreground'
                        }`}>
                        Live Collaboration
                    </h2>
                    {isConnected && (
                        <div className="flex items-center justify-center gap-2 text-emerald-300 text-sm">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span>Session Active</span>
                        </div>
                    )}
                </div>

                {isConnected ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-emerald-200 mb-2">
                                Share this URL:
                            </label>
                            <div className="flex gap-2">
                                <textarea
                                    className="flex-1 p-3 border border-emerald-500/30 rounded-md bg-emerald-950/50 text-emerald-100 resize-none h-20 font-mono text-xs"
                                    value={`${window.location.origin}/chart/room/${collaboration.room.id}`}
                                    readOnly
                                />
                                <button
                                    className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                                    onClick={handleCopyUrl}
                                    title="Copy URL"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white h-10 px-6 py-2 gap-2"
                                onClick={handleCollabExit}
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" />
                                </svg>
                                Exit Session
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <button
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 py-2 gap-2"
                            onClick={handleCollabStart}
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                            Start Session
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
