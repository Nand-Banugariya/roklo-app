import type { AuthUser } from "@/features/auth/types/auth.types";
import type { WorkspaceState } from "@/features/workspaces/types/workspace.types";
import { nanoid, type ThunkAction, type UnknownAction } from "@reduxjs/toolkit";
import type { createMessagingApi } from "../services/messaging-api";
import { chooseNumber, type ChatFilter, type Conversation, type WhatsAppNumber } from "../types";
import { messagingActions as actions, type MessagingState } from "./messaging-slice";

export interface MessagingRootState {
  auth: { user: AuthUser | null };
  workspace: WorkspaceState;
  messaging: MessagingState;
}
type Thunk<R> = ThunkAction<R, MessagingRootState, unknown, UnknownAction>;
type MessagingApi = Pick<ReturnType<typeof createMessagingApi>, "conversations" | "numbers">;
/** Numbers read per request. */
const NUMBERS_PAGE = 50;

/** Whose inbox this is: the signed-in user in the active workspace (null when either is missing). */
export const messagingScopeOf = (state: MessagingRootState) =>
  state.auth.user?.id && state.workspace.activeId
    ? `${state.auth.user.id}:${state.workspace.activeId}`
    : null;

/**
 * The inbox's API calls, as thunks on the `messaging` slice (as the broadcasts ones are made). Each works for
 * the signed-in user's active workspace (another one starts the slice over), and a late answer to an older
 * request, or one for a workspace left meanwhile, is dropped.
 */
export function createMessagingThunks(services: { api: (workspaceId: string) => MessagingApi }) {
  /** The current scope, after starting over if the slice belongs to another one. */
  function scopeOf(
    getState: () => MessagingRootState,
    dispatch: (action: UnknownAction) => unknown,
  ) {
    const scope = messagingScopeOf(getState());
    if (scope !== getState().messaging.scope) dispatch(actions.scopeChanged(scope));
    return scope;
  }

  /**
   * A page of a number's chats for a filter and search, into the list `key`. Resolves to the rows it
   * brought (for the screen's follow-up, e.g. reading mentions), or null when it failed or was overtaken.
   * `prepare` gets each row first (a mention preview already known, say).
   */
  function loadConversations(args: {
    key: string;
    sessionId: string;
    filter: ChatFilter;
    search: string;
    page: number;
    mode?: "quiet" | "more" | "pull";
    signal?: AbortSignal;
    prepare?: (row: Conversation) => Conversation;
  }): Thunk<Promise<Conversation[] | null>> {
    return async (dispatch, getState) => {
      const scope = scopeOf(getState, dispatch);
      const workspaceId = getState().workspace.activeId;
      if (!scope || !workspaceId) return null;
      const requestId = nanoid();
      dispatch(actions.listRequested({ key: args.key, requestId, mode: args.mode ?? "quiet" }));
      const result = await services
        .api(workspaceId)
        .conversations(args.sessionId, args.filter, args.search, args.page, args.signal);
      // Cancelled, another workspace meanwhile, or overtaken by a newer request for this list.
      if (
        args.signal?.aborted ||
        messagingScopeOf(getState()) !== scope ||
        getState().messaging.scope !== scope ||
        getState().messaging.lists[args.key]?.requestId !== requestId
      )
        return null;
      if (!result.ok) {
        dispatch(
          actions.listFailed({
            key: args.key,
            requestId,
            error: result.message || "Couldn't load your chats. Try again.",
          }),
        );
        return null;
      }
      // Defend number boundaries even if a server response includes unrelated rows.
      const rows = result.data.data
        .filter((row) => row.sessionId === args.sessionId)
        .map((row) => (args.prepare ? args.prepare(row) : row));
      dispatch(
        actions.listLoaded({
          key: args.key,
          requestId,
          page: args.page,
          rows,
          more: args.page * result.data.limit < result.data.total,
        }),
      );
      return rows;
    };
  }

  /**
   * The workspace's WhatsApp numbers, every page, and the one to work from: the one already active, else
   * `remembered` (picked on this phone before), else the first connected. Resolves to the complete list, or
   * null when it failed or was overtaken (the list stays as it was).
   */
  function loadNumbers(
    args: { remembered?: string | null; signal?: AbortSignal } = {},
  ): Thunk<Promise<WhatsAppNumber[] | null>> {
    return async (dispatch, getState) => {
      const scope = scopeOf(getState, dispatch);
      const workspaceId = getState().workspace.activeId;
      const requestId = nanoid();
      dispatch(actions.numbersRequested(requestId));
      // Signed out or no workspace: nothing to list.
      if (!scope || !workspaceId) {
        dispatch(actions.numbersLoaded({ requestId, items: [], activeId: null }));
        return [];
      }
      const current = () =>
        !args.signal?.aborted &&
        messagingScopeOf(getState()) === scope &&
        getState().messaging.scope === scope &&
        getState().messaging.numbers.requestId === requestId;
      const rows: WhatsAppNumber[] = [];
      for (let offset = 0; ; offset += NUMBERS_PAGE) {
        const result = await services.api(workspaceId).numbers(offset, args.signal);
        if (!current()) return null;
        if (!result.ok) {
          dispatch(
            actions.numbersFailed({
              requestId,
              error: result.message || "Couldn't load your WhatsApp numbers.",
            }),
          );
          return null;
        }
        rows.push(...result.data.sessions);
        if (result.data.sessions.length < NUMBERS_PAGE) break;
      }
      const chosen = chooseNumber(
        rows,
        getState().messaging.numbers.activeId ?? args.remembered ?? null,
      );
      dispatch(actions.numbersLoaded({ requestId, items: rows, activeId: chosen?.id ?? null }));
      return rows;
    };
  }

  return { loadConversations, loadNumbers };
}
