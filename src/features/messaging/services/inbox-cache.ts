import type { ChatMessage, Conversation, MessagePage } from "../types";

// In-memory copies so going back and forth feels instant, as on WhatsApp: a chat opened again shows its
// messages at once while they refresh quietly, and a chat list (per number, filter and search) comes
// back as it was. Cleared with the messaging provider (sign-out, another workspace).

/** Chats kept, the most recently opened first. */
const THREAD_LIMIT = 20;
const LIST_LIMIT = 12;

export interface CachedThread {
  conversation: Conversation;
  messages: ChatMessage[];
  cursor: MessagePage["nextCursor"];
  hasMore: boolean;
}
export interface CachedList { rows: Conversation[]; page: number; more: boolean }

const threads = new Map<string, CachedThread>();
const lists = new Map<string, CachedList>();
/** Chats read in the thread since the list last looked, so their unread badge clears on the way back. */
const readSince = new Set<string>();

function keep<T>(map: Map<string, T>, key: string, value: T, limit: number) {
  map.delete(key);
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value!);
}

export const cachedThread = (id: string) => threads.get(id) ?? null;
export function saveThread(id: string, thread: CachedThread) {
  // Optimistic copies are never kept: a reopened chat shows only what the server has.
  keep(threads, id, { ...thread, messages: thread.messages.filter((message) => !message.id.startsWith("local-")) }, THREAD_LIMIT);
}

export const cachedList = (key: string) => lists.get(key) ?? null;
export const saveList = (key: string, list: CachedList) => keep(lists, key, list, LIST_LIMIT);

export const markReadLocally = (id: string) => { readSince.add(id); };
/** Takes the chats read since the last call. */
export function takeReadLocally() {
  const ids = [...readSince];
  readSince.clear();
  return ids;
}

export function clearInboxCache() {
  threads.clear();
  lists.clear();
  readSince.clear();
}
