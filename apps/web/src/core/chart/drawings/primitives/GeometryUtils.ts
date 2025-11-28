export class GeometryUtils {
    /**
     * Calculate distance from a point to a line segment
     */
    static distanceToLineSegment(
        px: number, 
        py: number, 
        x1: number, 
        y1: number, 
        x2: number, 
        y2: number
    ): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) {
            // Line is actually a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }
        
        // Calculate the parameter t where the perpendicular from (px,py) meets the line
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        
        // Find the closest point on the line segment
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        
        // Return distance to closest point
        return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
    }

    /**
     * Calculate distance from a point to a vertical line
     */
    static distanceToVerticalLine(px: number, py: number, lineX: number, y1: number, y2: number): number {
        // Check if point is within the vertical bounds of the line
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        
        if (py >= minY && py <= maxY) {
            // Point is within vertical bounds, return horizontal distance
            return Math.abs(px - lineX);
        } else {
            // Point is outside vertical bounds, return distance to nearest endpoint
            const distToTop = Math.sqrt((px - lineX) * (px - lineX) + (py - minY) * (py - minY));
            const distToBottom = Math.sqrt((px - lineX) * (px - lineX) + (py - maxY) * (py - maxY));
            return Math.min(distToTop, distToBottom);
        }
    }

    /**
     * Calculate distance from a point to a horizontal line
     */
    static distanceToHorizontalLine(px: number, py: number, lineY: number, x1: number, x2: number): number {
        // Check if point is within the horizontal bounds of the line
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        
        if (px >= minX && px <= maxX) {
            // Point is within horizontal bounds, return vertical distance
            return Math.abs(py - lineY);
        } else {
            // Point is outside horizontal bounds, return distance to nearest endpoint
            const distToLeft = Math.sqrt((px - minX) * (px - minX) + (py - lineY) * (py - lineY));
            const distToRight = Math.sqrt((px - maxX) * (px - maxX) + (py - lineY) * (py - lineY));
            return Math.min(distToLeft, distToRight);
        }
    }

    /**
     * Check if a point is inside a rectangle
     */
    static isPointInRectangle(
        px: number, 
        py: number, 
        rectX: number, 
        rectY: number, 
        width: number, 
        height: number
    ): boolean {
        return px >= rectX && px <= rectX + width && py >= rectY && py <= rectY + height;
    }

    /**
     * Calculate distance from a point to a rectangle border
     */
    static distanceToRectangle(
        px: number, 
        py: number, 
        rectX: number, 
        rectY: number, 
        width: number, 
        height: number
    ): number {
        // If point is inside rectangle, distance is 0
        if (this.isPointInRectangle(px, py, rectX, rectY, width, height)) {
            return 0;
        }

        // Calculate distance to each edge
        const distToLeft = this.distanceToVerticalLine(px, py, rectX, rectY, rectY + height);
        const distToRight = this.distanceToVerticalLine(px, py, rectX + width, rectY, rectY + height);
        const distToTop = this.distanceToHorizontalLine(px, py, rectY, rectX, rectX + width);
        const distToBottom = this.distanceToHorizontalLine(px, py, rectY + height, rectX, rectX + width);

        return Math.min(distToLeft, distToRight, distToTop, distToBottom);
    }
}
