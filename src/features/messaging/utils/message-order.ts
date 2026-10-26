import type { ChatMessage, DeliveryStatus } from "../types";

/** Newest first, one copy per id: a later copy (socket, server) replaces an earlier one. */
export const mergeMessages = (old: ChatMessage[], incoming: ChatMessage[]) =>
  [...new Map([...old, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * The API's newest page over what's shown (the web app's applyNewestPage): inside the page's time window
 * the page is the truth, so a stored message it lacks was deleted and goes. Older pages, newer socket
 * messages and messages still sending stay.
 */
export function applyNewestPage(old: ChatMessage[], page: ChatMessage[]) {
  if (!page.length) return old;
  const times = page.map((message) => message.createdAt).sort();
  const [oldest, newest] = [times[0], times[times.length - 1]];
  const ids = new Set(page.map((message) => message.id));
  return mergeMessages(old.filter((message) => message.id.startsWith("local-") || ids.has(message.id)
    || message.createdAt < oldest || message.createdAt > newest), page);
}

const RANK: Record<DeliveryStatus, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: -1 };
/** Whether `next` moves a tick forward from `current`: never back, and FAILED only before delivery (the web app's rule). */
export function statusMovesForward(current: DeliveryStatus, next: DeliveryStatus) {
  return next === "FAILED" ? RANK[current] < RANK.DELIVERED : current === "FAILED" || RANK[next] > RANK[current];
}
