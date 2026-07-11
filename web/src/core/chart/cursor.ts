export type CursorType = 'default' | 'pointer' | 'crosshair'

export function setCursor(cursor: CursorType) {
    document.body.style.cursor = cursor
}