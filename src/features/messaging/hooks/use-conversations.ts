import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useMessaging } from "../providers/messaging-context";
import { loadConversations } from "../services/messaging-service";
import { JOINED_EVENT } from "../services/realtime";
import { makeSelectListRows, selectConversationList } from "../store/messaging-selectors";
import { conversationListKey, messagingActions } from "../store/messaging-slice";
import type { ChatFilter, Conversation, ConversationUpdatedEvent, ReadStateEvent } from "../types";
import { createPreviewMentionResolver } from "../utils/mentions";
import { useRealtimeEvent } from "./use-realtime-event";

/**
 * The active number's chats for a filter and search, from the `messaging` slice. Coming back to the list,
 * polling and live updates refresh it quietly: rows stay put with no spinner, as on WhatsApp. Only a first
 * load (the skeleton), the next page (the footer) and a pull to refresh show progress. A list seen before
 * comes back at once (the slice keeps the last few).
 */
export function useConversations(filter: ChatFilter, search: string) {
  const { api, activeNumber, live } = useMessaging();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const previewMentions = useMemo(
    () => createPreviewMentionResolver((id, signal) => api.messages(id, null, signal)),
    [api],
  );
  // A never-linked number has no chats to fetch; the inbox shows the first-time link prompt instead.
  const sessionId = activeNumber?.phoneNumber ? activeNumber.id : undefined;
  const key = conversationListKey(sessionId, filter, search);
  const list = useAppSelector((state) => selectConversationList(state, key));
  const selectRows = useMemo(() => makeSelectListRows(), []);
  const rows = useAppSelector((state) => selectRows(state, key));
  const request = useRef<AbortController | null>(null);
  const page = useRef(0);
  const fetchPage = useCallback(
    async (nextPage: number, mode: "quiet" | "more" | "pull" = "quiet") => {
      if (!sessionId) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const incoming = await dispatch(
        loadConversations({
          key,
          sessionId,
          filter,
          search,
          page: nextPage,
          mode,
          signal: controller.signal,
          prepare: previewMentions.cached,
        }),
      );
      if (!incoming || controller.signal.aborted) return;
      page.current = nextPage;
      void previewMentions.resolve(incoming, controller.signal, (resolved) => {
        dispatch(
          messagingActions.mentionsResolved({
            id: resolved.id,
            lastMessageAt: resolved.lastMessageAt,
            lastMessagePreview: resolved.lastMessagePreview,
            lastMessageMentionedParticipants: resolved.lastMessageMentionedParticipants,
          }),
        );
      });
    },
    [dispatch, sessionId, filter, search, key, previewMentions],
  );
  /** Changes some chats, each from its current row (a pin, a read, a status); every list showing them follows. */
  const patch = useCallback(
    (ids: string[], change: (row: Conversation) => Partial<Conversation>) => {
      const current = store.getState().messaging.conversations;
      const changes: Record<string, Partial<Conversation>> = {};
      for (const id of ids) if (current[id]) changes[id] = change(current[id]);
      dispatch(messagingActions.conversationsPatched(changes));
    },
    [dispatch, store],
  );
  const refetch = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFocusEffect(
    useCallback(() => {
      // Chats read while this list was out of sight lose their badge at once, before the quiet refresh.
      const read = store.getState().messaging.readLocally;
      if (read.length) {
        patch(read, () => ({ unreadCount: 0 }));
        dispatch(messagingActions.readLocallyTaken());
      }
      void fetchPage(1);
      // The socket keeps rows current; polling is the fallback while it's down.
      const timer = setInterval(
        () => {
          if (AppState.currentState === "active" && page.current <= 1) void fetchPage(1);
        },
        live ? 60000 : 15000,
      );
      return () => {
        clearInterval(timer);
        request.current?.abort();
        if (refetch.current) clearTimeout(refetch.current);
      };
    }, [fetchPage, live, patch, dispatch, store]),
  );

  // Live: patch loaded rows at once, then re-read the first page (order and new chats), batched.
  const schedule = useCallback(() => {
    if (refetch.current) clearTimeout(refetch.current);
    refetch.current = setTimeout(() => {
      refetch.current = null;
      if (page.current <= 1) void fetchPage(1);
    }, 600);
  }, [fetchPage]);
  useRealtimeEvent<ConversationUpdatedEvent>(
    "inbox.conversation.updated",
    (event) => {
      if (!event?.conversationId) return;
      dispatch(messagingActions.conversationUpdated(event));
      schedule();
    },
    !!sessionId,
  );
  // Teammates' sends emit no conversation event.
  useRealtimeEvent("inbox.message.new", schedule, !!sessionId);
  useRealtimeEvent<ReadStateEvent>(
    "inbox.read-state.updated",
    (event) => {
      if (event?.conversationIds)
        patch(event.conversationIds, () => ({
          unreadCount: event.unreadCount ?? 0,
        }));
      schedule();
    },
    !!sessionId,
  );
  useRealtimeEvent("inbox.conversations.synced", schedule, !!sessionId);
  useRealtimeEvent(JOINED_EVENT, schedule, !!sessionId);
  /** Removed from the inbox: gone from every list, and their kept threads with them. */
  const remove = useCallback(
    (ids: string[]) => {
      dispatch(messagingActions.conversationsRemoved(ids));
    },
    [dispatch],
  );
  // A list not loaded yet: nothing to show, and the skeleton.
  const current = {
    key,
    rows,
    page: list?.page ?? 0,
    more: list?.more ?? false,
    error: list?.error ?? null,
    loading: list?.loading ?? true,
    loadingMore: list?.loadingMore ?? false,
    refreshing: list?.refreshing ?? false,
  };
  return {
    ...current,
    patch,
    remove,
    /** Pull to refresh. */
    refresh: () => void fetchPage(1, "pull"),
    /** Re-reads the first page with no spinner, e.g. to move a pinned chat to the top. */
    reload: () => void fetchPage(1),
    loadMore: () => {
      if (current.more && !current.loadingMore && !current.loading)
        void fetchPage(current.page + 1, "more");
    },
  };
}
