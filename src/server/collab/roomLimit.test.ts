import { describe, it, expect } from "vitest";
import { DEFAULT_ROOM_LIMIT, getRoomLimit } from "./roomLimit";

describe("getRoomLimit", () => {
	it("defaults every user to one concurrent room", () => {
		expect(DEFAULT_ROOM_LIMIT).toBe(1);
		expect(getRoomLimit("anyone")).toBe(1);
		expect(getRoomLimit("someone-else")).toBe(1);
	});
});
