export interface RevealMeasurements {
  offset: number;
  viewportTop: number;
  viewportHeight: number;
  targetTop: number;
  targetHeight: number;
  keyboardTop?: number | null;
  padding?: number;
}

// Measure the outer container, before applying this inset. Android may already
// have resized it; an overlay keyboard (including Expo Go) may not have done so.
export function keyboardOverlap(
  viewportTop: number,
  viewportHeight: number,
  keyboardTop: number | null,
): number {
  if (keyboardTop == null) return 0;
  return Math.max(
    0,
    Math.min(viewportHeight, viewportTop + viewportHeight - keyboardTop),
  );
}

// Screen coordinates are used so both resized Android windows and iOS overlays work.
export function revealOffset({
  offset,
  viewportTop,
  viewportHeight,
  targetTop,
  targetHeight,
  keyboardTop,
  padding = 16,
}: RevealMeasurements): number {
  const top = viewportTop + padding;
  const bottom =
    Math.min(viewportTop + viewportHeight, keyboardTop ?? Infinity) - padding;
  if (bottom <= top) return offset;
  if (targetHeight > bottom - top || targetTop < top)
    return Math.max(0, offset + targetTop - top);
  if (targetTop + targetHeight > bottom)
    return Math.max(0, offset + targetTop + targetHeight - bottom);
  return offset;
}
