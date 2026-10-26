import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useMessaging } from "../providers/messaging-context";
import { cachedList, saveList, takeReadLocally } from "../services/inbox-cache";
import { JOINED_EVENT } from "../services/realtime";
import type { ChatFilter, Conversation, ConversationUpdatedEvent, ReadStateEvent } from "../types";
import { useRealtimeEvent } from "./use-realtime-event";

interface ListState {
  key: string; rows: Conversation[]; page: number; more: boolean; error: string | null;
  /** The first page is on its way and there's nothing to show yet: the skeleton. */
  loading: boolean;
  /** The next page is on its way: the footer spinner. */
  loadingMore: boolean;
  /** A pull to refresh: the only refresh that shows a spinner. */
  refreshing: boolean;
}
const fresh = (key: string): ListState => {
  const cached = cachedList(key);
  return { key, rows: cached?.rows ?? [], page: cached?.page ?? 0, more: cached?.more ?? false, error: null,
    loading: !cached, loadingMore: false, refreshing: false };
};

/**
 * The active number's chats for a filter and search. Coming back to the list, polling and live updates
 * refresh it quietly: rows stay put with no spinner, as on WhatsApp. Only a first load (the skeleton),
 * the next page (the footer) and a pull to refresh show progress. A list seen before comes back at once.
 */
export function useConversations(filter: ChatFilter, search: string) {
  const { api, activeNumber, live } = useMessaging();
  // A never-linked number has no chats to fetch; the inbox shows the first-time link prompt instead.
  const sessionId = activeNumber?.phoneNumber ? activeNumber.id : undefined;
  const key = `${sessionId}:${filter}:${search}`;
  const [state, setState] = useState<ListState>(() => fresh(key));
  const request = useRef<AbortController | null>(null);
  const page = useRef(0);
  const fetchPage = useCallback(async (nextPage: number, mode: "quiet" | "more" | "pull" = "quiet") => {
    if (!sessionId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((old) => {
      const base = old.key === key ? old : fresh(key);
      return { ...base, error: null, loadingMore: mode === "more", refreshing: mode === "pull", loading: base.loading && !base.rows.length };
    });
    const result = await api.conversations(sessionId, filter, search, nextPage, controller.signal);
    if (controller.signal.aborted) return;
    if (!result.ok) {
      setState((old) => ({ ...old, key, loading: false, loadingMore: false, refreshing: false, error: result.message || "Couldn't load your chats. Try again." }));
      return;
    }
    // Defend number boundaries even if a server response includes unrelated rows.
    const incoming = result.data.data.filter((row) => row.sessionId === sessionId);
    page.current = nextPage;
    setState((old) => ({ key, page: nextPage, more: nextPage * result.data.limit < result.data.total, error: null,
      loading: false, loadingMore: false, refreshing: false,
      rows: nextPage === 1 ? incoming : [...new Map([...old.rows, ...incoming].map((row) => [row.id, row])).values()] }));
  }, [api, sessionId, filter, search, key]);
  // Kept for coming back to this list (another filter, a search, the chat and back).
  useEffect(() => {
    if (state.key === key && !state.loading && !state.error) saveList(key, { rows: state.rows, page: state.page, more: state.more });
  }, [state, key]);
  const patch = useCallback((ids: string[], change: (row: Conversation) => Partial<Conversation>) => {
    setState((old) => ({ ...old, rows: old.rows.map((row) => ids.includes(row.id) ? { ...row, ...change(row) } : row) }));
  }, []);
  const refetch = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFocusEffect(useCallback(() => {
    // Chats read while this list was out of sight lose their badge at once, before the quiet refresh.
    const read = takeReadLocally();
    if (read.length) patch(read, () => ({ unreadCount: 0 }));
    void fetchPage(1);
    // The socket keeps rows current; polling is the fallback while it's down.
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && page.current <= 1) void fetchPage(1);
    }, live ? 60000 : 15000);
    return () => { clearInterval(timer); request.current?.abort(); if (refetch.current) clearTimeout(refetch.current); };
  }, [fetchPage, live, patch]));

  // Live: patch loaded rows at once, then re-read the first page (order and new chats), batched.
  const schedule = useCallback(() => {
    if (refetch.current) clearTimeout(refetch.current);
    refetch.current = setTimeout(() => { refetch.current = null; if (page.current <= 1) void fetchPage(1); }, 600);
  }, [fetchPage]);
  useRealtimeEvent<ConversationUpdatedEvent>("inbox.conversation.updated", (event) => {
    if (!event?.conversationId) return;
    patch([event.conversationId], (row) => ({ lastMessageAt: event.lastMessageAt, lastMessagePreview: event.lastMessagePreview,
      status: event.status, unreadCount: row.unreadCount + (event.unreadIncrement ?? 0) }));
    schedule();
  }, !!sessionId);
  // Teammates' sends emit no conversation event.
  useRealtimeEvent("inbox.message.new", schedule, !!sessionId);
  useRealtimeEvent<ReadStateEvent>("inbox.read-state.updated", (event) => {
    if (event?.conversationIds) patch(event.conversationIds, () => ({ unreadCount: event.unreadCount ?? 0 }));
    schedule();
  }, !!sessionId);
  useRealtimeEvent("inbox.conversations.synced", schedule, !!sessionId);
  useRealtimeEvent(JOINED_EVENT, schedule, !!sessionId);
  const current = state.key === key ? state : fresh(key);
  return { ...current,
    /** Pull to refresh. */
    refresh: () => void fetchPage(1, "pull"),
    loadMore: () => { if (current.more && !current.loadingMore && !current.loading) void fetchPage(current.page + 1, "more"); } };
}
