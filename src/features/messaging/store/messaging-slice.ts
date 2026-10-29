import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ChatMessage,
  Conversation,
  ConversationUpdatedEvent,
  MessagePage,
  WhatsAppNumber,
} from "../types";

/** Chat lists kept (per number, filter and search), the most recently loaded last. */
export const LIST_LIMIT = 12;
/** Chats opened recently kept in memory, so opening one again shows it at once. */
export const THREAD_LIMIT = 20;

/** A chat as it was last shown: opened again, it shows this at once while it refreshes quietly. */
export interface KeptThread {
  conversation: Conversation;
  messages: ChatMessage[];
  cursor: MessagePage["nextCursor"];
  hasMore: boolean;
}

/** One chat list as the inbox (or Forward) shows it: its chats by id, in order, and its progress. */
export interface ConversationList {
  ids: string[];
  page: number;
  more: boolean;
  error: string | null;
  /** The first page is on its way and there's nothing to show yet: the skeleton. */
  loading: boolean;
  /** The next page is on its way: the footer spinner. */
  loadingMore: boolean;
  /** A pull to refresh: the only refresh that shows a spinner. */
  refreshing: boolean;
  /** The request whose answer the list takes; an older one's late answer is dropped. */
  requestId: string | null;
}

/** The workspace's WhatsApp numbers, and the one the inbox works from. */
export interface NumbersState {
  items: WhatsAppNumber[];
  activeId: string | null;
  /** Until the first list arrives, the inbox waits on it (a spinner, not "connect a number"). */
  loading: boolean;
  error: string | null;
  /** The request whose answer the list takes; an older one's late answer is dropped. */
  requestId: string | null;
}

/**
 * The inbox's API data and recently opened chats (every message is also stored on the phone, in SQLite:
 * see message-store; opened again after a restart, a chat reads it from there).
 * Each chat is kept once, so a change (a pin, a read, a new last message) shows in every list it's in.
 * It belongs to one signed-in user and workspace (`scope`): another one starts it over.
 */
export interface MessagingState {
  scope: string | null;
  conversations: Record<string, Conversation>;
  lists: Record<string, ConversationList>;
  /** List keys, the least recently loaded first, for keeping only LIST_LIMIT. */
  listOrder: string[];
  /** Chats read in the thread since the list last looked, so their unread badge clears on the way back. */
  readLocally: string[];
  /** Recently opened chats by id, and their ids, the least recently shown first. */
  threads: Record<string, KeptThread>;
  threadOrder: string[];
  numbers: NumbersState;
}

export const initialMessagingState = (scope: string | null = null): MessagingState => ({
  scope,
  conversations: {},
  lists: {},
  listOrder: [],
  readLocally: [],
  threads: {},
  threadOrder: [],
  numbers: { items: [], activeId: null, loading: true, error: null, requestId: null },
});

/** A list key: the number, filter and search it shows. */
export const conversationListKey = (
  sessionId: string | undefined,
  filter: string,
  search: string,
) => `${sessionId}:${filter}:${search}`;

const emptyList = (): ConversationList => ({
  ids: [],
  page: 0,
  more: false,
  error: null,
  loading: true,
  loadingMore: false,
  refreshing: false,
  requestId: null,
});

/** Chats no list shows any more are let go (the stored messages stay on the phone). */
function dropUnlisted(state: MessagingState) {
  const listed = new Set(Object.values(state.lists).flatMap((list) => list.ids));
  for (const id of Object.keys(state.conversations))
    if (!listed.has(id)) delete state.conversations[id];
}

const slice = createSlice({
  name: "messaging",
  initialState: initialMessagingState(),
  reducers: {
    /** Another user or workspace (or signing out): everything starts over. */
    scopeChanged(_state, { payload }: PayloadAction<string | null>) {
      return initialMessagingState(payload);
    },

    // ── Lists ─────────────────────────────────────────────────────────────
    /** A page was asked for. Quiet refreshes keep the rows with no spinner; only an empty list shows the skeleton. */
    listRequested(
      state,
      {
        payload,
      }: PayloadAction<{ key: string; requestId: string; mode: "quiet" | "more" | "pull" }>,
    ) {
      const list = (state.lists[payload.key] ??= emptyList());
      list.requestId = payload.requestId;
      list.error = null;
      list.loadingMore = payload.mode === "more";
      list.refreshing = payload.mode === "pull";
      list.loading = list.loading && !list.ids.length;
    },
    /** A page arrived: page 1 is the list's new start, later pages add to it. */
    listLoaded(
      state,
      {
        payload,
      }: PayloadAction<{
        key: string;
        requestId: string;
        page: number;
        more: boolean;
        rows: Conversation[];
      }>,
    ) {
      const list = state.lists[payload.key];
      if (!list || list.requestId !== payload.requestId) return;
      for (const row of payload.rows) state.conversations[row.id] = row;
      const incoming = payload.rows.map((row) => row.id);
      list.ids = payload.page === 1 ? incoming : [...new Set([...list.ids, ...incoming])];
      list.page = payload.page;
      list.more = payload.more;
      list.error = null;
      list.loading = list.loadingMore = list.refreshing = false;
      list.requestId = null;
      // Kept for coming back to it (another filter, a search, the chat and back); the oldest go.
      state.listOrder = [...state.listOrder.filter((key) => key !== payload.key), payload.key];
      if (state.listOrder.length > LIST_LIMIT) {
        for (const key of state.listOrder.splice(0, state.listOrder.length - LIST_LIMIT))
          delete state.lists[key];
        dropUnlisted(state);
      }
    },
    listFailed(
      state,
      { payload }: PayloadAction<{ key: string; requestId: string; error: string }>,
    ) {
      const list = state.lists[payload.key];
      if (!list || list.requestId !== payload.requestId) return;
      list.error = payload.error;
      list.loading = list.loadingMore = list.refreshing = false;
      list.requestId = null;
    },

    // ── Chats ─────────────────────────────────────────────────────────────
    /** Changes to some chats (a pin, a read, a status), each its own. */
    conversationsPatched(state, { payload }: PayloadAction<Record<string, Partial<Conversation>>>) {
      for (const [id, change] of Object.entries(payload)) {
        const row = state.conversations[id];
        if (row) state.conversations[id] = { ...row, ...change };
      }
    },
    /** Live: a chat's last message, status and unread count changed. */
    conversationUpdated(state, { payload }: PayloadAction<ConversationUpdatedEvent>) {
      const row = state.conversations[payload.conversationId];
      if (!row) return;
      state.conversations[payload.conversationId] = {
        ...row,
        lastMessageAt: payload.lastMessageAt,
        lastMessagePreview: payload.lastMessagePreview,
        lastMessageMentionedParticipants: undefined,
        status: payload.status,
        unreadCount: row.unreadCount + (payload.unreadIncrement ?? 0),
      };
    },
    /** The people a last message mentions, once read; only while it's still that chat's last message. */
    mentionsResolved(
      state,
      {
        payload,
      }: PayloadAction<
        Pick<
          Conversation,
          "id" | "lastMessageAt" | "lastMessagePreview" | "lastMessageMentionedParticipants"
        >
      >,
    ) {
      const row = state.conversations[payload.id];
      if (
        !row ||
        row.lastMessageAt !== payload.lastMessageAt ||
        row.lastMessagePreview !== payload.lastMessagePreview
      )
        return;
      row.lastMessageMentionedParticipants = payload.lastMessageMentionedParticipants;
    },
    /** Removed from the inbox: gone from every list. */
    conversationsRemoved(state, { payload }: PayloadAction<string[]>) {
      const gone = new Set(payload);
      for (const list of Object.values(state.lists))
        list.ids = list.ids.filter((id) => !gone.has(id));
      for (const id of payload) {
        delete state.conversations[id];
        delete state.threads[id];
      }
      state.readLocally = state.readLocally.filter((id) => !gone.has(id));
      state.threadOrder = state.threadOrder.filter((id) => !gone.has(id));
    },

    // ── Opened chats ──────────────────────────────────────────────────────
    /** Kept for the next time this chat opens; the oldest go. Optimistic copies never are: only what the server has. */
    threadSaved(state, { payload }: PayloadAction<{ id: string; thread: KeptThread }>) {
      state.threads[payload.id] = {
        ...payload.thread,
        messages: payload.thread.messages.filter((message) => !message.id.startsWith("local-")),
      };
      state.threadOrder = [...state.threadOrder.filter((id) => id !== payload.id), payload.id];
      for (const id of state.threadOrder.splice(
        0,
        Math.max(0, state.threadOrder.length - THREAD_LIMIT),
      ))
        delete state.threads[id];
    },

    // ── Numbers ───────────────────────────────────────────────────────────
    numbersRequested(state, { payload }: PayloadAction<string>) {
      state.numbers.requestId = payload;
    },
    /** The complete list, and the number to work from (the one picked before, else the first connected). */
    numbersLoaded(
      state,
      {
        payload,
      }: PayloadAction<{ requestId: string; items: WhatsAppNumber[]; activeId: string | null }>,
    ) {
      if (state.numbers.requestId !== payload.requestId) return;
      state.numbers = {
        items: payload.items,
        activeId: payload.activeId,
        loading: false,
        error: null,
        requestId: null,
      };
    },
    numbersFailed(state, { payload }: PayloadAction<{ requestId: string; error: string }>) {
      if (state.numbers.requestId !== payload.requestId) return;
      state.numbers.loading = false;
      state.numbers.error = payload.error;
      state.numbers.requestId = null;
    },
    /** The inbox works from another number (one in the list). */
    numberSelected(state, { payload }: PayloadAction<string>) {
      if (state.numbers.items.some((number) => number.id === payload))
        state.numbers.activeId = payload;
    },

    // ── Read in the thread ────────────────────────────────────────────────
    readLocally(state, { payload }: PayloadAction<string>) {
      if (!state.readLocally.includes(payload)) state.readLocally.push(payload);
    },
    /** The list has cleared their badges. */
    readLocallyTaken(state) {
      state.readLocally = [];
    },
  },
});

export const messagingActions = slice.actions;
export default slice.reducer;
