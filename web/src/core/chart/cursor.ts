export type CursorType = 'default' | 'pointer' | 'crosshair' | 'move' | 'grab'

export function setCursor(cursor: CursorType | '', target: HTMLElement) {
  target.style.cursor = cursor
}
