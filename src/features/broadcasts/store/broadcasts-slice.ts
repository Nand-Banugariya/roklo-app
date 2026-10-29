import { signedOut } from "../../auth/store/auth-slice";
import type { AccessTarget } from "@/features/messaging/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AvailableGroup,
  Broadcast,
  BroadcastCounts,
  BroadcastFilter,
  BroadcastRun,
  BroadcastSummary,
  BroadcastTag,
} from "../types";

type Status = "idle" | "loading" | "ready" | "error";
export interface AudienceContact {
  id: string;
  name: string | null;
  mobileNumber: string;
}

export interface BroadcastsState {
  /** The workspace this state belongs to: another one starts over. */
  workspaceId: string | null;
  /** The list on the Broadcast tab, for its filter and search. */
  list: {
    filter: BroadcastFilter;
    search: string;
    /** Only broadcasts with any of these tags; empty for every tag. */
    tagIds: string[];
    ids: string[];
    page: number;
    total: number;
    more: boolean;
    status: Status;
    loadingMore: boolean;
    refreshing: boolean;
    error: string | null;
  };
  counts: BroadcastCounts | null;
  /** List rows by id: the detail screen shows a broadcast's numbers from here at once. */
  rows: Record<string, Broadcast>;
  /** Each opened broadcast: what GET /campaigns/:id says, and its runs (newest first). */
  details: Record<
    string,
    {
      summary: BroadcastSummary | null;
      runIds: string[];
      runTotal: number;
      status: Status;
      error: string | null;
      loadingRuns: boolean;
    }
  >;
  /** Runs by id; a single run's read adds its delivered and read counts. */
  runs: Record<string, BroadcastRun>;
  runDetails: Record<string, { status: Status; error: string | null }>;
  tags: { items: BroadcastTag[] | null; status: Status; error: string | null };
  /** The New broadcast audience picker's current list, for one tab, search and numbers (`key`). */
  audience: {
    key: string;
    status: Status;
    error: string | null;
    contacts: AudienceContact[];
    contactsMore: boolean;
    groups: AvailableGroup[];
  };
  /** Teams and people a TEAM broadcast can be shared with. */
  access: {
    teams: AccessTarget[];
    members: AccessTarget[];
    status: Status;
    error: string | null;
  };
  /** The request each part waits for: a late answer to an older one is ignored. */
  requests: {
    list: string | null;
    counts: string | null;
    details: Record<string, string>;
    audience: string | null;
  };
}

export const initialBroadcastsState = (workspaceId: string | null = null): BroadcastsState => ({
  workspaceId,
  list: {
    filter: "ALL",
    search: "",
    tagIds: [],
    ids: [],
    page: 0,
    total: 0,
    more: false,
    status: "idle",
    loadingMore: false,
    refreshing: false,
    error: null,
  },
  counts: null,
  rows: {},
  details: {},
  runs: {},
  runDetails: {},
  tags: { items: null, status: "idle", error: null },
  audience: {
    key: "",
    status: "idle",
    error: null,
    contacts: [],
    contactsMore: false,
    groups: [],
  },
  access: { teams: [], members: [], status: "idle", error: null },
  requests: { list: null, counts: null, details: {}, audience: null },
});

const detailOf = (state: BroadcastsState, id: string) =>
  (state.details[id] ??= {
    summary: null,
    runIds: [],
    runTotal: 0,
    status: "idle",
    error: null,
    loadingRuns: false,
  });

const slice = createSlice({
  name: "broadcasts",
  initialState: initialBroadcastsState(),
  reducers: {
    workspaceChanged(_state, { payload }: PayloadAction<string | null>) {
      return initialBroadcastsState(payload);
    },

    // ── List ──────────────────────────────────────────────────────────────
    /** Another filter, search or tags: a fresh list (the skeleton until it comes). */
    queryChanged(
      state,
      {
        payload,
      }: PayloadAction<{
        filter?: BroadcastFilter;
        search?: string;
        tagIds?: string[];
      }>,
    ) {
      const filter = payload.filter ?? state.list.filter;
      const search = payload.search ?? state.list.search;
      // In a stable order, so the same tags picked differently are the same query.
      const tagIds = payload.tagIds ? [...new Set(payload.tagIds)].sort() : state.list.tagIds;
      if (
        filter === state.list.filter &&
        search === state.list.search &&
        tagIds.join(",") === state.list.tagIds.join(",")
      )
        return;
      state.list = { ...initialBroadcastsState().list, filter, search, tagIds };
      state.requests.list = null;
    },
    listStarted(
      state,
      { payload }: PayloadAction<{ requestId: string; mode: "quiet" | "pull" | "more" }>,
    ) {
      state.requests.list = payload.requestId;
      state.list.error = null;
      state.list.loadingMore = payload.mode === "more";
      state.list.refreshing = payload.mode === "pull";
      if (!state.list.ids.length && payload.mode !== "more") state.list.status = "loading";
    },
    listLoaded(
      state,
      {
        payload,
      }: PayloadAction<{
        requestId: string;
        page: number;
        broadcasts: Broadcast[];
        total: number;
        hasMore: boolean;
      }>,
    ) {
      if (state.requests.list !== payload.requestId) return;
      for (const row of payload.broadcasts) state.rows[row.id] = row;
      const ids = payload.broadcasts.map((row) => row.id);
      state.list.ids = payload.page === 1 ? ids : [...new Set([...state.list.ids, ...ids])];
      Object.assign(state.list, {
        page: payload.page,
        total: payload.total,
        more: payload.hasMore,
        status: "ready",
        loadingMore: false,
        refreshing: false,
        error: null,
      });
      state.requests.list = null;
    },
    listFailed(state, { payload }: PayloadAction<{ requestId: string; message: string }>) {
      if (state.requests.list !== payload.requestId) return;
      Object.assign(state.list, {
        status: state.list.ids.length ? "ready" : "error",
        loadingMore: false,
        refreshing: false,
        error: payload.message,
      });
      state.requests.list = null;
    },
    countsStarted(state, { payload }: PayloadAction<string>) {
      state.requests.counts = payload;
    },
    countsLoaded(
      state,
      { payload }: PayloadAction<{ requestId: string; counts: BroadcastCounts }>,
    ) {
      if (state.requests.counts !== payload.requestId) return;
      state.counts = payload.counts;
      state.requests.counts = null;
    },
    /** Cancelled or deleted: gone from the list at once. */
    removed(state, { payload }: PayloadAction<string>) {
      state.list.ids = state.list.ids.filter((id) => id !== payload);
      state.list.total = Math.max(0, state.list.total - 1);
      delete state.rows[payload];
      delete state.details[payload];
    },

    // ── One broadcast ─────────────────────────────────────────────────────
    detailStarted(state, { payload }: PayloadAction<{ id: string; requestId: string }>) {
      const detail = detailOf(state, payload.id);
      state.requests.details[payload.id] = payload.requestId;
      if (!detail.summary) detail.status = "loading";
      detail.error = null;
    },
    detailLoaded(
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
        requestId: string;
        summary: BroadcastSummary;
        runs: BroadcastRun[] | null;
        runTotal: number;
      }>,
    ) {
      if (state.requests.details[payload.id] !== payload.requestId) return;
      const detail = detailOf(state, payload.id);
      detail.summary = payload.summary;
      if (payload.runs) {
        for (const run of payload.runs)
          state.runs[run.id] = {
            ...state.runs[run.id],
            ...run,
            delivered: state.runs[run.id]?.delivered ?? run.delivered,
            read: state.runs[run.id]?.read ?? run.read,
          };
        detail.runIds = payload.runs.map((run) => run.id);
        detail.runTotal = payload.runTotal;
      }
      detail.status = "ready";
      delete state.requests.details[payload.id];
    },
    detailFailed(
      state,
      { payload }: PayloadAction<{ id: string; requestId: string; message: string }>,
    ) {
      if (state.requests.details[payload.id] !== payload.requestId) return;
      const detail = detailOf(state, payload.id);
      detail.status = "error";
      detail.error = payload.message;
      delete state.requests.details[payload.id];
    },
    olderRunsStarted(state, { payload }: PayloadAction<string>) {
      detailOf(state, payload).loadingRuns = true;
    },
    olderRunsLoaded(
      state,
      { payload }: PayloadAction<{ id: string; runs: BroadcastRun[]; runTotal: number }>,
    ) {
      const detail = detailOf(state, payload.id);
      for (const run of payload.runs) state.runs[run.id] = run;
      detail.runIds = [...new Set([...detail.runIds, ...payload.runs.map((run) => run.id)])];
      detail.runTotal = payload.runTotal;
      detail.loadingRuns = false;
    },
    olderRunsFailed(state, { payload }: PayloadAction<string>) {
      detailOf(state, payload).loadingRuns = false;
    },
    runStarted(state, { payload }: PayloadAction<string>) {
      state.runDetails[payload] = { status: "loading", error: null };
    },
    runLoaded(state, { payload }: PayloadAction<BroadcastRun>) {
      state.runs[payload.id] = payload;
      state.runDetails[payload.id] = { status: "ready", error: null };
    },
    runFailed(state, { payload }: PayloadAction<{ runId: string; message: string }>) {
      state.runDetails[payload.runId] = {
        status: "error",
        error: payload.message,
      };
    },

    // ── New broadcast ─────────────────────────────────────────────────────
    tagsStarted(state) {
      if (!state.tags.items) state.tags.status = "loading";
      state.tags.error = null;
    },
    tagsLoaded(state, { payload }: PayloadAction<BroadcastTag[]>) {
      state.tags = { items: payload, status: "ready", error: null };
    },
    tagsFailed(state, { payload }: PayloadAction<string>) {
      state.tags.status = "error";
      state.tags.error = payload;
    },
    tagAdded(state, { payload }: PayloadAction<BroadcastTag>) {
      state.tags.items = [
        ...(state.tags.items ?? []).filter((tag) => tag.id !== payload.id),
        payload,
      ].sort((a, b) => a.name.localeCompare(b.name));
    },
    audienceStarted(state, { payload }: PayloadAction<{ key: string; requestId: string }>) {
      state.requests.audience = payload.requestId;
      state.audience.key = payload.key;
      state.audience.status = "loading";
      state.audience.error = null;
    },
    audienceLoaded(
      state,
      {
        payload,
      }: PayloadAction<{
        requestId: string;
        contacts?: AudienceContact[];
        contactsMore?: boolean;
        groups?: AvailableGroup[];
      }>,
    ) {
      if (state.requests.audience !== payload.requestId) return;
      if (payload.contacts) {
        state.audience.contacts = payload.contacts;
        state.audience.contactsMore = payload.contactsMore ?? false;
      }
      if (payload.groups) state.audience.groups = payload.groups;
      state.audience.status = "ready";
      state.requests.audience = null;
    },
    audienceFailed(state, { payload }: PayloadAction<{ requestId: string; message: string }>) {
      if (state.requests.audience !== payload.requestId) return;
      state.audience.status = "error";
      state.audience.error = payload.message;
      state.requests.audience = null;
    },
    moreContactsLoaded(
      state,
      {
        payload,
      }: PayloadAction<{
        key: string;
        contacts: AudienceContact[];
        hasMore: boolean;
      }>,
    ) {
      if (state.audience.key !== payload.key) return;
      state.audience.contacts = [
        ...new Map(
          [...state.audience.contacts, ...payload.contacts].map((row) => [row.id, row]),
        ).values(),
      ];
      state.audience.contactsMore = payload.hasMore;
    },
    accessStarted(state) {
      if (state.access.status !== "ready") state.access.status = "loading";
      state.access.error = null;
    },
    accessLoaded(
      state,
      { payload }: PayloadAction<{ teams: AccessTarget[]; members: AccessTarget[] }>,
    ) {
      state.access = { ...payload, status: "ready", error: null };
    },
    accessFailed(state, { payload }: PayloadAction<string>) {
      state.access.status = "error";
      state.access.error = payload;
    },
  },
  extraReducers: (builder) => {
    // Broadcasts belong to the signed-in user's workspace: nothing carries over.
    builder.addCase(signedOut, () => initialBroadcastsState());
  },
});

export const broadcastsActions = slice.actions;
export default slice.reducer;
