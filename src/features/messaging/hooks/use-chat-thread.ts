import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useMessaging } from "../providers/messaging-context";
import { cachedThread, markReadLocally, saveThread } from "../services/inbox-cache";
import { patchCachedStatus, pruneCache, putCachedMessages, readCachedChat, replaceCachedWindow } from "../services/message-store";
import { setOpenConversation } from "../services/open-conversation";
import { applyNewestPage, mergeMessages } from "../utils/message-order";
import { JOINED_EVENT } from "../services/realtime";
import type { ChatMessage, Conversation, DeliveryStatus, MessageNewEvent, MessagePage, MessageStatusEvent } from "../types";
import { useRealtimeEvent } from "./use-realtime-event";

// The web app's reveal (lib/inbox/constants.ts).
const REVEAL_PAGE_SIZE = 100;
const REVEAL_MAX_PAGES = 20;
const STATUS_ORDER: DeliveryStatus[] = ["QUEUED", "SENT", "DELIVERED", "READ"];
/** Ticks only move forward (a late "delivered" never undoes "read"); FAILED always shows. */
function laterStatus(current: DeliveryStatus, next: DeliveryStatus) {
  if (next === "FAILED" || current === "FAILED") return next;
  return STATUS_ORDER.indexOf(next) > STATUS_ORDER.indexOf(current) ? next : current;
}
const merge = mergeMessages;

export function useChatThread(id: string, sessionId: string) {
  const { api, activeNumber, live } = useMessaging();
  // A chat opened before shows at once from memory and refreshes quietly; only a first open shows the skeleton.
  const [cached] = useState(() => {
    const thread = cachedThread(id);
    return thread && thread.conversation.sessionId === sessionId ? thread : null;
  });
  const [conversation, setConversation] = useState<Conversation | null>(cached?.conversation ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages ?? []);
  // The loaded messages for async work (finding a quoted message) that outlives a render.
  const latest = useRef<ChatMessage[]>(cached?.messages ?? []);
  useEffect(() => { latest.current = messages; }, [messages]);
  // An empty cached copy cannot prove the server still has no messages.
  const [loading, setLoading] = useState(!cached?.messages.length);
  const [backfilling, setBackfilling] = useState(false);
  const awaitingMessages = loading || (backfilling && messages.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(cached?.hasMore ?? false);
  // The same as `more`, for loops that page back without waiting for a render.
  const hasMore = useRef(cached?.hasMore ?? false);
  const cursor = useRef<MessagePage["nextCursor"]>(cached?.cursor ?? null);
  const controller = useRef<AbortController | null>(null);
  const loadingOlder = useRef(false);
  const valid = sessionId === activeNumber?.id;
  /** The API's first page arrived this visit: the stored copy no longer paints over it. */
  const apiLoaded = useRef(false);
  // The phone's stored copy (SQLite) paints at once when this chat isn't in memory; the API then reconciles it.
  // The skeleton shows only while it's read, or when nothing is stored.
  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void readCachedChat(id).then((stored) => {
      if (cancelled || apiLoaded.current || !stored.messages.length) return;
      setMessages((old) => merge(old, stored.messages));
      if (stored.conversation?.id === id && stored.conversation.sessionId === sessionId) setConversation((old) => old ?? stored.conversation);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [cached, id, sessionId]);
  // Socket messages for other chats update their stored copies (MessageStoreSync); this one keeps itself current.
  useEffect(() => { setOpenConversation(id); return () => setOpenConversation(null); }, [id]);
  const load = useCallback(async () => {
    if (!valid) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    if (!apiLoaded.current && !latest.current.length) setLoading(true);
    setError(null);
    const result = await api.conversation(id, sessionId, request.signal);
    if (request.signal.aborted) return;
    if (!result.ok) { setError(result.message || "Couldn't open this conversation."); setLoading(false); return; }
    const chat = result.data.data.find((row) => row.id === id && row.sessionId === sessionId);
    if (!chat) { setError("This conversation is no longer available."); setLoading(false); return; }
    setConversation(chat);
    const thread = await api.messages(id, null, request.signal);
    if (request.signal.aborted) return;
    if (!thread.ok) { setError(thread.message || "Couldn't load messages."); setLoading(false); return; }
    setBackfilling(thread.data.backfilling);
    // The newest page is the truth for its window, over the stored copy and older pages already loaded.
    setMessages((old) => applyNewestPage(old, thread.data.data));
    // Stored as on the web app: the first page of a visit reconciles the copy and trims it; refreshes add to it.
    if (!apiLoaded.current) void replaceCachedWindow(id, thread.data.data, sessionId, chat).then(() => pruneCache(id));
    else void putCachedMessages(thread.data.data, sessionId);
    apiLoaded.current = true;
    if (!cursor.current) { cursor.current = thread.data.nextCursor; hasMore.current = thread.data.hasMore; setMore(thread.data.hasMore); }
    if (chat.unreadCount > 0) { void api.markRead(id); markReadLocally(id); }
    setLoading(false);
  }, [api, id, sessionId, valid]);
  // Kept for the next time this chat opens.
  useEffect(() => {
    if (conversation && !awaitingMessages && !error) saveThread(id, { conversation, messages, cursor: cursor.current, hasMore: hasMore.current });
  }, [id, conversation, messages, awaitingMessages, error]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]));
  useFocusEffect(useCallback(() => {
    // The socket brings new messages and ticks; polling is the fallback while it's down.
    // While importing history, check again sooner without overlapping slow requests.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      timer = setTimeout(async () => {
        if (AppState.currentState === "active") await load();
        if (!cancelled) schedule();
      }, backfilling ? 2000 : live ? 60000 : 10000);
    }
    schedule();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [load, live, backfilling]));
  useRealtimeEvent<MessageNewEvent>("inbox.message.new", (event) => {
    if (event?.conversationId !== id) return;
    // Also sent again once inbound media finishes downloading: always re-read.
    void api.message(id, event.messageId).then((result) => {
      if (!result.ok) { void load(); return; }
      setMessages((old) => merge(old, [result.data]));
      setLoading(false);
      void putCachedMessages([result.data], sessionId);
      if (result.data.direction === "INBOUND") { void api.markRead(id); markReadLocally(id); }
    });
  }, valid);
  useRealtimeEvent<MessageStatusEvent>("inbox.message.status", (event) => {
    if (event?.conversationId !== id) return;
    setMessages((old) => old.map((message) => message.id === event.messageId
      ? { ...message, deliveryStatus: laterStatus(message.deliveryStatus, event.deliveryStatus) } : message));
    void patchCachedStatus(event.messageId, event.deliveryStatus);
  }, valid);
  useRealtimeEvent<{ conversationId: string }>("inbox.conversation.backfilled", (event) => {
    if (event?.conversationId === id) void load();
  }, valid);
  // Events sent while disconnected were missed.
  useRealtimeEvent(JOINED_EVENT, () => void load(), valid);
  /** The next older page; resolves with its messages, or null when there's none or it failed. */
  async function loadOlder(limit?: number): Promise<ChatMessage[] | null> {
    if (!hasMore.current || !cursor.current || loadingOlder.current || !valid) return null;
    loadingOlder.current = true;
    const signal = controller.current?.signal;
    const result = await api.messages(id, cursor.current, signal, limit);
    loadingOlder.current = false;
    if (signal?.aborted) return null;
    if (!result.ok) { setError(result.message || "Couldn't load older messages."); return null; }
    cursor.current = result.data.nextCursor; hasMore.current = result.data.hasMore; setMore(result.data.hasMore);
    setMessages((old) => merge(old, result.data.data));
    void putCachedMessages(result.data.data, sessionId);
    return result.data.data;
  }
  /**
   * Pages back until `messageId` is loaded (a quoted or pinned message far up the chat), as the web app's
   * reveal does: pages of REVEAL_PAGE_SIZE, giving up after REVEAL_MAX_PAGES.
   */
  async function findOlder(ids: readonly string[]) {
    const has = (list: ChatMessage[]) => list.some((message) => ids.includes(message.id));
    // A refresh or the socket may have brought it in meanwhile.
    if (has(latest.current)) return true;
    for (let page = 0; page < REVEAL_MAX_PAGES; page++) {
      // An older page already on its way (scrolling up) comes first: wait for it rather than giving up.
      for (let wait = 0; loadingOlder.current && wait < 50; wait++) await new Promise((resolve) => setTimeout(resolve, 100));
      if (has(latest.current)) return true;
      const older = await loadOlder(REVEAL_PAGE_SIZE);
      if (!older) return has(latest.current);
      if (has(older)) return true;
    }
    return has(latest.current);
  }
  function append(message: ChatMessage) {
    setMessages((old) => [message, ...old.filter((item) => item.id !== message.id)]);
    setLoading(false);
  }
  /** Swaps an optimistic message for the server's copy, or drops it when sending failed. */
  function replace(localId: string, message: ChatMessage | null) {
    if (message) void putCachedMessages([message], sessionId);
    setMessages((old) => {
      const rest = old.filter((item) => item.id !== localId && item.id !== message?.id);
      return message ? [message, ...rest] : rest;
    });
  }
  /** Updates one loaded message in place (a reaction, a pin, the server's copy after an action). */
  function patch(messageId: string, change: Partial<ChatMessage>) {
    const current = latest.current.find((message) => message.id === messageId);
    // The stored copy follows (a reaction, a pin, or putting either back when the API refused).
    if (current) void putCachedMessages([{ ...current, ...change }], sessionId);
    setMessages((old) => old.map((message) => message.id === messageId ? { ...message, ...change } : message));
  }
  function refresh() {
    if (!latest.current.length) setLoading(true);
    return load();
  }
  return { conversation, messages, loading: awaitingMessages && !error, error, more, loadOlder, findOlder, refresh, append, replace, patch, valid };
}
