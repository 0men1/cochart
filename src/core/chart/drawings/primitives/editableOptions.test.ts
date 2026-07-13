import { describe, it, expect } from "vitest";
import type { Time } from "cochart-charts";
import { TrendLine } from "./TrendLine";
import { Ray } from "./Ray";
import { Rectangle } from "./Rectangle";
import { FibonacciRetracement } from "./FibonacciRetracement";
import { HorizontalLine } from "./HorizontalLine";
import { VertLine } from "./VertLine";
import { BaseDrawing } from "./BaseDrawing";
import { DrawingOptionKey, EditableOption } from "../types";
import type { Point } from "@/core/chart/types";

const pts: Point[] = [
	{ time: 1 as Time, price: 100 },
	{ time: 2 as Time, price: 110 },
];

function byKey(d: BaseDrawing): Map<DrawingOptionKey, EditableOption> {
	return new Map(d.getEditableOptions().map((o) => [o.key, o]));
}

describe("drawing editable option schemas", () => {
	it("TrendLine and Ray expose color + width (width bounded 1-4)", () => {
		for (const d of [new TrendLine(pts), new Ray(pts)]) {
			const m = byKey(d);
			expect(m.get(DrawingOptionKey.COLOR)?.type).toBe("color");
			expect(m.get(DrawingOptionKey.WIDTH)).toMatchObject({ type: "number", min: 1, max: 4, step: 1 });
		}
	});

	it("Rectangle exposes border + fill options", () => {
		const m = byKey(new Rectangle(pts));
		expect(m.get(DrawingOptionKey.COLOR)?.type).toBe("color");
		expect(m.get(DrawingOptionKey.FILL_COLOR)?.type).toBe("color");
		expect(m.get(DrawingOptionKey.FILL_OPACITY)).toMatchObject({ type: "number", min: 0, max: 1, step: 0.05 });
	});

	it("Fibonacci exposes color, width, fill opacity", () => {
		const m = byKey(new FibonacciRetracement(pts));
		expect(m.get(DrawingOptionKey.COLOR)?.type).toBe("color");
		expect(m.get(DrawingOptionKey.WIDTH)?.type).toBe("number");
		expect(m.get(DrawingOptionKey.FILL_OPACITY)?.type).toBe("number");
	});

	it("Horizontal and Vertical lines expose line + label options", () => {
		for (const d of [new HorizontalLine(pts), new VertLine(pts)]) {
			const m = byKey(d);
			expect(m.get(DrawingOptionKey.COLOR)?.type).toBe("color");
			expect(m.get(DrawingOptionKey.WIDTH)?.type).toBe("number");
			expect(m.get(DrawingOptionKey.SHOW_LABEL)?.type).toBe("boolean");
			expect(m.get(DrawingOptionKey.LABEL_TEXT)?.type).toBe("text");
			expect(m.get(DrawingOptionKey.LABEL_BACKGROUND_COLOR)?.type).toBe("color");
			expect(m.get(DrawingOptionKey.LABEL_TEXT_COLOR)?.type).toBe("color");
		}
	});
});
