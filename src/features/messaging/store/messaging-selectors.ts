import { createSelector } from "@reduxjs/toolkit";
import type { ConversationList } from "./messaging-slice";
import type { MessagingRootState } from "./messaging-thunks";

const conversations = (state: MessagingRootState) => state.messaging.conversations;

export const selectConversationList = (
  state: MessagingRootState,
  key: string,
): ConversationList | null => state.messaging.lists[key] ?? null;
export const selectConversation = (state: MessagingRootState, id: string) =>
  state.messaging.conversations[id] ?? null;
export const selectReadLocally = (state: MessagingRootState) => state.messaging.readLocally;

/**
 * A list's chats, in order: one array until the list or one of its chats changes. Made per screen
 * (`useMemo`), so each keeps its own memo for its own list.
 */
export const makeSelectListRows = () =>
  createSelector(
    [conversations, (state: MessagingRootState, key: string) => state.messaging.lists[key]?.ids],
    (rows, ids) => (ids ?? []).map((id) => rows[id]).filter((row) => row !== undefined),
  );
/** A recently opened chat as last shown, or null. */
export const selectThread = (state: MessagingRootState, id: string) =>
  state.messaging.threads[id] ?? null;
export const selectNumbers = (state: MessagingRootState) => state.messaging.numbers;
/** The number the inbox works from, or null. */
export const selectActiveNumber = createSelector(
  [selectNumbers],
  (numbers) => numbers.items.find((number) => number.id === numbers.activeId) ?? null,
);
