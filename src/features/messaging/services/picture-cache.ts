// Chats' profile pictures, kept in memory so the chat list, the open chat and other screens share one
// request per chat (the web app's lib/inbox/picture-cache.ts). The API proxies WhatsApp and caches for an
// hour, so this keeps them as long. A failed request isn't kept: the next screen to show that chat asks again.

const TTL_MS = 60 * 60 * 1000;
/** Requests in flight at once, so a fresh list doesn't fire a page of them together. */
const CONCURRENCY = 4;

export type PictureLoader = (id: string) => Promise<{ ok: true; data: { url: string | null } } | { ok: false }>;

/** `url` null: the chat has no picture. */
const pictures = new Map<string, { url: string | null; at: number }>();
const listeners = new Set<() => void>();
const queued: { id: string; load: PictureLoader }[] = [];
const loading = new Set<string>();

/** The chat's picture: a URL, null for none, undefined while unknown. */
export function cachedPicture(id: string): string | null | undefined {
  const entry = pictures.get(id);
  return entry && Date.now() - entry.at < TTL_MS ? entry.url : undefined;
}

export function subscribePictures(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Queues a fetch of the chat's picture unless it's known or on its way. */
export function loadPicture(id: string, load: PictureLoader) {
  if (cachedPicture(id) !== undefined || loading.has(id) || queued.some((item) => item.id === id)) return;
  queued.push({ id, load });
  pump();
}

/** Forgets every picture (sign-out, another workspace). */
export function clearPictures() {
  pictures.clear();
  queued.length = 0;
  listeners.forEach((listener) => listener());
}

function pump() {
  while (loading.size < CONCURRENCY && queued.length) {
    const { id, load } = queued.shift()!;
    loading.add(id);
    void load(id).catch(() => ({ ok: false as const })).then((result) => {
      loading.delete(id);
      if (result.ok) {
        // Only web URLs reach the image view.
        const url = result.data?.url && /^https?:\/\//i.test(result.data.url) ? result.data.url : null;
        pictures.set(id, { url, at: Date.now() });
        listeners.forEach((listener) => listener());
      }
      pump();
    });
  }
}
