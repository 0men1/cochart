const control_point_s = 9;
const control_point_border_s = 1.5;

export interface ControlPointsStyle {
	fillColor: string;
	borderColor: string;
}

// White fill + accent-blue border reads clearly on both light and dark chart
// backgrounds without needing canvas access to CSS theme variables.
const defaultControlPointStyle: ControlPointsStyle = {
	fillColor: '#ffffff',
	borderColor: '#2962ff'
}

export function drawControlPoints(
	ctx: CanvasRenderingContext2D,
	scope: any,
	points: { x: number, y: number }[],
	style: ControlPointsStyle = defaultControlPointStyle
) {
	if (points.length === 0) return;

	const size = control_point_s * scope.horizontalPixelRatio;
	const borderWidth = control_point_border_s * scope.horizontalPixelRatio;

	points.forEach(point => {
		ctx.beginPath();
		ctx.arc(point.x, point.y, size / 2, 0, 2 * Math.PI);

		ctx.fillStyle = style.fillColor;
		ctx.fill();

		if (borderWidth > 0) {
			ctx.strokeStyle = style.borderColor;
			ctx.lineWidth = borderWidth;
			ctx.stroke();
		}
	})
}
