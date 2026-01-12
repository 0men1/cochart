const control_point_s = 7;
const control_point_border_s = 2;

export interface ControlPointsStyle {
	fillColor: string;
	borderColor: string;
}

const defaultControlPointStyle: ControlPointsStyle = {
	fillColor: '#000000',
	borderColor: '#FF0000'
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
