import type { BaseDrawing } from './primitives/BaseDrawing';

let resolver: () => BaseDrawing | null = () => null;

export function setSelectedDrawingAccessor(fn: () => BaseDrawing | null): void {
  resolver = fn;
}

export function getSelectedDrawing(): BaseDrawing | null {
  return resolver();
}
