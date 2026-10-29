import type { AuthUser } from "@/features/auth/types/auth.types";
import type { createMessagingApi } from "@/features/messaging/services/messaging-api";
import type { WorkspaceState } from "@/features/workspaces/types/workspace.types";
import type { ApiResult } from "@/services/api/create-client";
import { nanoid, type ThunkAction, type UnknownAction } from "@reduxjs/toolkit";
import type { BroadcastsApi } from "../services/broadcasts-api";
import type {
  AvailableGroup,
  BroadcastDraft,
  BroadcastStatus,
  CreateResult,
  NewBroadcastInput,
} from "../types";
import { broadcastsActions as actions, type BroadcastsState } from "./broadcasts-slice";

export interface BroadcastsRootState {
  auth: { user: AuthUser | null };
  workspace: WorkspaceState;
  broadcasts: BroadcastsState;
}
type Thunk<R> = ThunkAction<R, BroadcastsRootState, unknown, UnknownAction>;
type MessagingApi = Pick<ReturnType<typeof createMessagingApi>, "contacts" | "teams" | "members">;

/** Rows per page of the list (the API allows 50 requests a minute). */
export const PAGE_SIZE = 20;
const RUNS_PAGE_SIZE = 10;
/** The New broadcast audience picker's tabs. */
export type AudienceTab = "roklo" | "wa" | "contacts";
/** A group the picked numbers can post in (announcement-only groups take admins' posts only). */
export const canPostTo = (group: AvailableGroup) => !group.isAnnounce || group.isAdminSession;

/**
 * Every broadcast API call, as thunks on the `broadcasts` slice, as the workspace thunks are made. Each one
 * works in the active workspace (another one starts the slice over) and tags its request, so a late answer
 * to an older one is dropped. Actions resolve to the API's result, for the screen's own message.
 */
export function createBroadcastsThunks(services: {
  api: (workspaceId: string) => BroadcastsApi;
  messaging: (workspaceId: string) => MessagingApi;
}) {
  /** The active workspace's id, after starting over if the slice belongs to another one. */
  function workspaceOf(
    getState: () => BroadcastsRootState,
    dispatch: (action: UnknownAction) => unknown,
  ) {
    const id = getState().workspace.activeId;
    if (id !== getState().broadcasts.workspaceId) dispatch(actions.workspaceChanged(id));
    return id;
  }
  /** Still the same workspace as when the request started. */
  const same = (getState: () => BroadcastsRootState, workspaceId: string) =>
    getState().broadcasts.workspaceId === workspaceId;

  // ── List ────────────────────────────────────────────────────────────────
  /** The list's first page and the counts (quiet, or a pull to refresh), or its next page. */
  function loadBroadcasts(mode: "quiet" | "pull" | "more" = "quiet"): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId) return;
      const { list } = getState().broadcasts;
      if (mode === "more" && (!list.more || list.loadingMore || list.status !== "ready")) return;
      const page = mode === "more" ? list.page + 1 : 1;
      const requestId = nanoid();
      const api = services.api(workspaceId);
      dispatch(actions.listStarted({ requestId, mode }));
      const counting = page === 1 ? nanoid() : null;
      if (counting) dispatch(actions.countsStarted(counting));
      const [result, counts] = await Promise.all([
        api.list({
          page,
          limit: PAGE_SIZE,
          search: list.search,
          filter: list.filter,
          tagIds: list.tagIds,
        }),
        counting ? api.counts(list.search, list.tagIds) : Promise.resolve(null),
      ]);
      if (!same(getState, workspaceId)) return;
      if (counting && counts?.ok)
        dispatch(actions.countsLoaded({ requestId: counting, counts: counts.data }));
      if (result.ok) dispatch(actions.listLoaded({ requestId, page, ...result.data }));
      else
        dispatch(
          actions.listFailed({
            requestId,
            message: result.message || "Couldn't load broadcasts. Try again.",
          }),
        );
    };
  }
  /** Another status filter, search or tags, then its list. */
  function setBroadcastsQuery(query: {
    filter?: BroadcastsState["list"]["filter"];
    search?: string;
    tagIds?: string[];
  }): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      workspaceOf(getState, dispatch);
      const before = getState().broadcasts.list;
      dispatch(actions.queryChanged(query));
      // queryChanged starts the list over only when something changed.
      if (getState().broadcasts.list !== before) await dispatch(loadBroadcasts());
    };
  }

  // ── One broadcast ───────────────────────────────────────────────────────
  /** Its summary and latest runs. */
  function loadBroadcast(id: string): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId) return;
      const requestId = nanoid();
      const api = services.api(workspaceId);
      dispatch(actions.detailStarted({ id, requestId }));
      const [detail, runs] = await Promise.all([api.summary(id), api.runs(id, 1, RUNS_PAGE_SIZE)]);
      if (!same(getState, workspaceId)) return;
      if (!detail.ok) {
        dispatch(
          actions.detailFailed({
            id,
            requestId,
            message:
              detail.status === 404
                ? "This broadcast was cancelled or deleted."
                : detail.message || "Couldn't load this broadcast. Try again.",
          }),
        );
        return;
      }
      dispatch(
        actions.detailLoaded({
          id,
          requestId,
          summary: detail.data,
          runs: runs.ok ? runs.data.runs : null,
          runTotal: runs.ok ? runs.data.total : 0,
        }),
      );
    };
  }
  function loadOlderRuns(id: string): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      const detail = getState().broadcasts.details[id];
      if (!workspaceId || !detail || detail.loadingRuns) return;
      dispatch(actions.olderRunsStarted(id));
      const result = await services
        .api(workspaceId)
        .runs(id, Math.floor(detail.runIds.length / RUNS_PAGE_SIZE) + 1, RUNS_PAGE_SIZE);
      if (!same(getState, workspaceId)) return;
      if (result.ok)
        dispatch(
          actions.olderRunsLoaded({
            id,
            runs: result.data.runs,
            runTotal: result.data.total,
          }),
        );
      else dispatch(actions.olderRunsFailed(id));
    };
  }
  /** One run with its delivered and read counts. */
  function loadRun(id: string, runId: string): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId) return;
      dispatch(actions.runStarted(runId));
      const result = await services.api(workspaceId).run(id, runId);
      if (!same(getState, workspaceId)) return;
      if (result.ok) dispatch(actions.runLoaded(result.data));
      else
        dispatch(
          actions.runFailed({
            runId,
            message: result.message || "Couldn't load this run. Try again.",
          }),
        );
    };
  }

  /** A change the API makes, then the list and the broadcast as they are now. */
  function change<T>(
    id: string,
    call: (api: BroadcastsApi) => Promise<ApiResult<T>>,
  ): Thunk<Promise<ApiResult<T>>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId)
        return {
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        };
      const result = await call(services.api(workspaceId));
      if (result.ok && same(getState, workspaceId)) {
        void dispatch(loadBroadcasts());
        if (getState().broadcasts.details[id]) void dispatch(loadBroadcast(id));
      }
      return result;
    };
  }
  const pauseBroadcast = (id: string) => change(id, (api) => api.pause(id));
  /** Back to scheduled: it continues where it stopped. */
  const resumeBroadcast = (id: string) => change(id, (api) => api.resume(id));
  const sendBroadcastNow = (id: string) => change(id, (api) => api.sendNow(id));
  /** A new draft named "Copy of …". */
  const duplicateBroadcast = (id: string) => change(id, (api) => api.duplicate(id));
  /** A scheduled or paused broadcast's message, changed alone. */
  const updateBroadcastMessage = (id: string, content: string) =>
    change(id, (api) => api.updateMessage(id, content));
  /** Its message as it is now, for "Edit message" (read fresh each time, not kept in the slice). */
  function loadBroadcastMessage(id: string): Thunk<
    Promise<
      ApiResult<{
        name: string;
        status: BroadcastStatus;
        content: string;
        files: number;
      }>
    >
  > {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId)
        return {
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        };
      return services.api(workspaceId).message(id);
    };
  }
  /** Its tags, replaced (up to 5). */
  const updateBroadcastTags = (id: string, tagIds: string[]) =>
    change(id, (api) => api.updateTags(id, tagIds));
  /** Cancels a scheduled or paused broadcast, or deletes a draft: gone from the list at once. */
  function removeBroadcast(id: string): Thunk<Promise<ApiResult<unknown>>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId)
        return {
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        };
      const result = await services.api(workspaceId).remove(id);
      if (result.ok && same(getState, workspaceId)) {
        dispatch(actions.removed(id));
        void dispatch(loadBroadcasts());
      }
      return result;
    };
  }

  // ── New broadcast ───────────────────────────────────────────────────────
  function createBroadcast(
    input: NewBroadcastInput,
    options: { isDraft?: boolean; acknowledgeContactRisk?: boolean } = {},
  ): Thunk<Promise<CreateResult>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId) return { ok: false, error: "Choose a workspace first." };
      const result = await services.api(workspaceId).create(input, options);
      if (result.ok && same(getState, workspaceId)) void dispatch(loadBroadcasts());
      return result;
    };
  }
  /** A saved draft changed; `activate` schedules it (it then sends now, or at its time). */
  function updateBroadcast(
    id: string,
    input: NewBroadcastInput,
    options: { activate?: boolean; acknowledgeContactRisk?: boolean } = {},
  ): Thunk<Promise<CreateResult>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId) return { ok: false, error: "Choose a workspace first." };
      const result = await services.api(workspaceId).update(id, input, options);
      if (result.ok && same(getState, workspaceId)) {
        void dispatch(loadBroadcasts());
        if (getState().broadcasts.details[id]) void dispatch(loadBroadcast(id));
      }
      return result;
    };
  }
  /** A draft as the builder fills it back in (read fresh each time it's opened, not kept in the slice). */
  function loadDraft(id: string): Thunk<Promise<ApiResult<BroadcastDraft>>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId)
        return {
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        };
      return services.api(workspaceId).draft(id);
    };
  }
  /** The workspace's broadcast tags, once (again with `force`). */
  function loadTags(force = false): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      const { tags } = getState().broadcasts;
      if (!workspaceId || tags.status === "loading" || (tags.status === "ready" && !force)) return;
      dispatch(actions.tagsStarted());
      const result = await services.api(workspaceId).tags();
      if (!same(getState, workspaceId)) return;
      if (result.ok) dispatch(actions.tagsLoaded(result.data));
      else dispatch(actions.tagsFailed(result.message || "Couldn't load tags."));
    };
  }
  function createTag(
    name: string,
    color: string,
  ): Thunk<Promise<ApiResult<{ id: string; name: string; color: string | null }>>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId)
        return {
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        };
      const result = await services.api(workspaceId).createTag(name, color);
      if (result.ok && same(getState, workspaceId)) dispatch(actions.tagAdded(result.data));
      return result;
    };
  }
  /** The audience picker's list for a tab, search and numbers. */
  function searchAudience(
    tab: AudienceTab,
    search: string,
    sessionIds: string[],
  ): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId) return;
      const key = audienceKey(tab, search, sessionIds);
      const requestId = nanoid();
      dispatch(actions.audienceStarted({ key, requestId }));
      if (tab === "contacts") {
        const result = await services.messaging(workspaceId).contacts(search, 0);
        if (!same(getState, workspaceId)) return;
        if (result.ok)
          dispatch(
            actions.audienceLoaded({
              requestId,
              contacts: result.data.contacts,
              contactsMore: result.data.hasMore,
            }),
          );
        else
          dispatch(
            actions.audienceFailed({
              requestId,
              message: result.message || "Couldn't load contacts.",
            }),
          );
        return;
      }
      const result = await services
        .api(workspaceId)
        .availableGroups(tab === "roklo" ? "ROKLO" : "WA", search, tab === "wa" ? sessionIds : []);
      if (!same(getState, workspaceId)) return;
      if (result.ok) dispatch(actions.audienceLoaded({ requestId, groups: result.data }));
      // The server's own words when it gives some, else its status, so a failure can be told apart.
      else
        dispatch(
          actions.audienceFailed({
            requestId,
            message:
              result.message ||
              `Couldn't load groups${result.status ? ` (error ${result.status})` : ""}.`,
          }),
        );
    };
  }
  function loadMoreContacts(): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      const { audience } = getState().broadcasts;
      if (!workspaceId || !audience.contactsMore) return;
      const search = audience.key.split("|")[1] ?? "";
      const result = await services
        .messaging(workspaceId)
        .contacts(search, audience.contacts.length);
      if (result.ok && same(getState, workspaceId))
        dispatch(
          actions.moreContactsLoaded({
            key: audience.key,
            contacts: result.data.contacts,
            hasMore: result.data.hasMore,
          }),
        );
    };
  }
  /** The WhatsApp groups the numbers can post in, to drop picked ones they can't; null when unknown. */
  function postableGroups(sessionIds: string[]): Thunk<Promise<Set<string> | null>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId || !sessionIds.length) return null;
      const result = await services.api(workspaceId).availableGroups("WA", "", sessionIds);
      return result.ok ? new Set(result.data.filter(canPostTo).map((group) => group.id)) : null;
    };
  }
  /** Teams and active members, for a TEAM broadcast. */
  function loadAccessTargets(): Thunk<Promise<void>> {
    return async (dispatch, getState) => {
      const workspaceId = workspaceOf(getState, dispatch);
      if (!workspaceId || getState().broadcasts.access.status === "loading") return;
      dispatch(actions.accessStarted());
      const messaging = services.messaging(workspaceId);
      const [teams, members] = await Promise.all([messaging.teams(), messaging.members()]);
      if (!same(getState, workspaceId)) return;
      if (!teams.ok || !members.ok) {
        dispatch(
          actions.accessFailed(
            (!teams.ok ? teams.message : !members.ok ? members.message : "") ||
              "Couldn't load teams and people.",
          ),
        );
        return;
      }
      dispatch(
        actions.accessLoaded({
          teams: teams.data.map((team) => ({
            id: team.id,
            name: team.name,
            detail:
              team._count?.members != null
                ? `${team._count.members} ${team._count.members === 1 ? "member" : "members"}`
                : undefined,
          })),
          // The API rejects access for pending or disabled members.
          members: members.data
            .flatMap((member) =>
              member.status === "ENABLED" && member.user
                ? [
                    {
                      id: member.user.id,
                      name: member.user.name?.trim() || member.user.email || "Unnamed",
                      detail: member.user.email || undefined,
                    },
                  ]
                : [],
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        }),
      );
    };
  }

  return {
    loadBroadcasts,
    setBroadcastsQuery,
    loadBroadcast,
    loadOlderRuns,
    loadRun,
    pauseBroadcast,
    resumeBroadcast,
    sendBroadcastNow,
    duplicateBroadcast,
    updateBroadcastTags,
    updateBroadcastMessage,
    loadBroadcastMessage,
    removeBroadcast,
    createBroadcast,
    updateBroadcast,
    loadDraft,
    loadTags,
    createTag,
    searchAudience,
    loadMoreContacts,
    postableGroups,
    loadAccessTargets,
  };
}

/** Which audience list is on screen: one tab, search and set of numbers. */
export const audienceKey = (tab: AudienceTab, search: string, sessionIds: string[]) =>
  `${tab}|${search}|${sessionIds.join(",")}`;
