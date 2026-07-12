export type CursorType = 'default' | 'pointer' | 'crosshair'

// Sets the cursor on a specific element (e.g. the chart) rather than the whole
// document, so a chart-only cursor never leaks onto the surrounding UI. Pass ''
// to clear the inline cursor and fall back to the element's CSS cursor.
export function setCursor(cursor: CursorType | '', target: HTMLElement) {
    target.style.cursor = cursor
}
