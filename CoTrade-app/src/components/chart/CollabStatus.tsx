'use client'

import { useRouter } from "next/navigation";
import { useApp } from "@/components/chart/context"

export default function CollabStatus() {
    const { state, action } = useApp();
    const { collaboration } = state
    const router = useRouter();

    if (!collaboration.isOpen) return null;

    async function handleCollabStart() {
        if (!process.env.NEXT_PUBLIC_ROOMS_URL_CREATE) {
            console.error("error: start collab session url cannot be found")
            return;
        }
        try {
            const response = await fetch(process.env.NEXT_PUBLIC_ROOMS_URL_CREATE, {
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

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => action.toggleCollabWindow(false)}
        >
            <div
                className="bg-background border rounded-lg shadow-lg p-8 w-96 max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                        Live Collaboration
                    </h2>
                </div>

                {collaboration.room.id != null ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Your Display Name:
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="w-full p-3 border rounded-md bg-background text-foreground"
                                    value={state.collaboration.displayName}
                                    // onChange={(e) => setNewName(e.target.value)}
                                    readOnly
                                    placeholder="Enter your name"
                                />
                                <button
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                // onClick={handleNameChange}
                                >
                                    Change
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Share this URL:
                            </label>
                            <textarea
                                className="w-full p-3 border rounded-md bg-background text-foreground resize-none h-20"
                                value={`/chart/room/${collaboration.room.id}`}
                                readOnly
                            />
                        </div>
                        <div className="flex justify-center">
                            <button
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-6 py-2 gap-2"
                                onClick={() => handleCollabExit()}
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <rect x="6" y="6" width="12" height="12" />
                                </svg>
                                Exit Session
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <button
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 gap-2"
                            onClick={handleCollabStart}
                        >
                            <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
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
