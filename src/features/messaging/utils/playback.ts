/**
 * One sound at a time, as on WhatsApp: when an audio message or a video starts, whatever was playing pauses.
 * Each player claims playback with its own pause; releasing only clears it if it still holds it.
 */
let current: { id: string; pause: () => void } | null = null;

export function claimPlayback(id: string, pause: () => void) {
  if (current && current.id !== id) {
    const previous = current;
    current = null;
    try { previous.pause(); } catch { /* its player was already released */ }
  }
  current = { id, pause };
}

export function releasePlayback(id: string) {
  if (current?.id === id) current = null;
}
