// How many rooms a single identity (userId) may occupy at the same time.
//
// This is the extension point for a future paid tier: getRoomLimit is the one
// place a subscription/tier lookup would raise the cap. Everything downstream
// (the join route, RoomManager) already honours an arbitrary N, so only this
// function needs to change when paid multi-room lands.
export const DEFAULT_ROOM_LIMIT = 1;

export function getRoomLimit(userId: string): number {
	// TODO(paid): look up the user's tier and return their allowance.
	void userId;
	return DEFAULT_ROOM_LIMIT;
}
