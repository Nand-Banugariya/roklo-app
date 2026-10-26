export interface KeyboardViewportOptions {
  screenHeight: number;
  windowHeight: number;
  keyboardTop?: number | null;
  viewportTop?: number;
  viewportBottom?: number;
  safeTop: number;
  safeBottom: number;
  gap?: number;
}

/** Insets use screen coordinates, as required by the native popover primitive. */
export function keyboardViewport({
  screenHeight,
  windowHeight,
  keyboardTop,
  viewportTop = 0,
  viewportBottom = windowHeight,
  safeTop,
  safeBottom,
  gap = 12,
}: KeyboardViewportOptions) {
  const visibleBottom = Math.min(
    screenHeight - safeBottom,
    windowHeight,
    viewportBottom,
    keyboardTop ?? Infinity,
  );
  const top = Math.max(safeTop, viewportTop) + gap;
  const bottom = Math.max(0, screenHeight - visibleBottom) + gap;
  return { top, bottom, maxHeight: Math.max(0, screenHeight - bottom - top) };
}
