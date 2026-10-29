import type { ApiResult, createApiClient, RequestOptions } from "@/services/api/create-client";
import type {
  AvailableGroup,
  Broadcast,
  BroadcastCounts,
  BroadcastDraft,
  BroadcastFilter,
  BroadcastPage,
  BroadcastRun,
  BroadcastRunPage,
  BroadcastRunStatus,
  BroadcastStatus,
  BroadcastSummary,
  BroadcastTag,
  CreateResult,
  NewAudience,
  NewBroadcastInput,
  RepeatType,
  SendMode,
  WeekDay,
} from "../types";

// roklo-api's `campaigns` module, as the web app reads it. It answers without the success envelope.
interface ApiCampaign {
  id: string;
  name: string;
  status: BroadcastStatus;
  sendMode: SendMode;
  scheduledAt: string | null;
  timezone: string;
  repeatType: RepeatType;
  repeatInterval: number | null;
  repeatUntil: string | null;
  weekDays: WeekDay[];
  totalRecipients: number;
  failedRecipients: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  stuckDueToCapAt: string | null;
  createdAt: string;
  tags?: { id: string; name: string; color: string | null }[];
  // What a draft reopened in the builder fills back in.
  templateId?: string | null;
  content?: string | null;
  /** Storage keys (older rows may hold full URLs). */
  files?: string[];
  visibility?: string;
  batchSize?: number;
  batchSizeMax?: number;
}
export interface ApiCampaignListItem extends ApiCampaign {
  template: { id: string; name: string } | null;
  nextScheduledAt: string | null;
  stats: {
    sentCount: number;
    deliveredCount: number;
    repliedCount: number;
    totalTargets: number;
    sessionName: string | null;
  } | null;
}
interface ApiCampaignList {
  campaigns: ApiCampaignListItem[];
  total: number;
  hasMore: boolean;
}
interface ApiCampaignDetail extends ApiCampaign {
  template?: { id: string; name: string } | null;
  hasGroupTargets?: boolean;
  /** TEAM: each grant is a team or one person. */
  accessGrants?: {
    team: { id: string; name: string } | null;
    user: { id: string; name: string | null } | null;
  }[];
  campaignSessions?: { sessionId: string }[];
  variations?: { content: string; position: number }[];
}
/** GET /campaigns/:id/targets: who it goes to, one row each. */
interface ApiTarget {
  targetType: "CONTACT" | "GROUP" | "ROKLO_GROUP";
  contact: {
    id: string;
    name: string;
    wahaContactId: string | null;
    isDeleted: boolean;
  } | null;
  group: {
    id: string;
    name: string;
    type: "WA" | "ROKLO";
    isDeleted: boolean;
  } | null;
}
/** Targets read per request when a draft is reopened. */
const TARGETS_PAGE_SIZE = 200;
export interface ApiCampaignRun {
  id: string;
  campaignId: string;
  runNumber: number;
  status: BroadcastRunStatus;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  totalTargets: number;
  /** Only on GET /campaigns/:id/runs/:runId. */
  deliveredCount?: number;
  readCount?: number;
  replyCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  ghostFlagged: boolean;
  ghostPausedUntil: string | null;
  stuckDueToCapAt: string | null;
}

/** "Send now" goes this far ahead, on a saved broadcast or a new one (the API needs a future time). */
const SEND_NOW_LEAD_MS = 15_000;
/** Finished broadcasts read per request, and at most this many requests, while matching Failed / Completed. */
const OUTCOME_SCAN_LIMIT = 200;
const OUTCOME_SCAN_PAGES = 5;
const SENT_STATUSES: BroadcastStatus[] = ["RUNNING", "COMPLETED", "FAILED", "PARTIALLY_COMPLETED"];
const FAILURE_STATUSES: BroadcastStatus[] = ["FAILED", "PARTIALLY_COMPLETED"];

const toRepeat = (campaign: ApiCampaign) => ({
  type: campaign.repeatType ?? "NONE",
  interval: campaign.repeatInterval ?? null,
  weekDays: campaign.weekDays ?? [],
  until: campaign.repeatUntil ?? null,
});

/**
 * How it ended, for the list: newer broadcasts finish COMPLETED with their failures counted, so one with
 * failures reads Failed (nothing went out) or Partly sent, as older ones were stored.
 */
export const outcomeStatus = (
  status: BroadcastStatus,
  sent: number,
  failed: number,
): BroadcastStatus =>
  status === "COMPLETED" && failed > 0 ? (sent > 0 ? "PARTIALLY_COMPLETED" : "FAILED") : status;

export function toBroadcast(campaign: ApiCampaignListItem): Broadcast {
  const stats = campaign.stats;
  const sent = stats?.sentCount ?? 0;
  const failed = campaign.failedRecipients ?? 0;
  // The list has no "sent at": repeats keep `lastRunAt`; a one-off went out at its scheduled time,
  // or when it was created for "send now".
  const lastSentAt =
    campaign.lastRunAt ??
    (sent > 0 || SENT_STATUSES.includes(campaign.status)
      ? (campaign.scheduledAt ?? campaign.createdAt)
      : null);
  return {
    id: campaign.id,
    name: campaign.name,
    status: outcomeStatus(campaign.status, sent, failed),
    sendMode: campaign.sendMode,
    templateName: campaign.template?.name ?? null,
    totalRecipients: campaign.totalRecipients ?? 0,
    tags: (campaign.tags ?? []).map(({ id, name, color }) => ({
      id,
      name,
      color: color ?? null,
    })),
    sent,
    delivered: stats?.deliveredCount ?? 0,
    replied: stats?.repliedCount ?? 0,
    failed,
    targets: stats?.totalTargets ?? 0,
    sessionName: stats?.sessionName ?? null,
    nextScheduledAt: campaign.nextScheduledAt ?? null,
    scheduledAt: campaign.scheduledAt,
    lastSentAt,
    repeat: toRepeat(campaign),
    timezone: campaign.timezone || "UTC",
    stuckDueToCapAt: campaign.stuckDueToCapAt ?? null,
    createdAt: campaign.createdAt,
  };
}

export const toBroadcastRun = (run: ApiCampaignRun): BroadcastRun => ({
  id: run.id,
  broadcastId: run.campaignId,
  runNumber: run.runNumber,
  status: run.status,
  total: run.totalTargets ?? 0,
  sent: run.sentCount ?? 0,
  failed: run.failedCount ?? 0,
  pending: run.pendingCount ?? 0,
  delivered: run.deliveredCount ?? null,
  read: run.readCount ?? null,
  replied: run.replyCount ?? 0,
  createdAt: run.createdAt,
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  pausedAt: run.pausedAt,
  pauseReason: run.pauseReason ?? null,
  ghostFlagged: run.ghostFlagged ?? false,
  ghostPausedUntil: run.ghostPausedUntil ?? null,
  stuckDueToCapAt: run.stuckDueToCapAt ?? null,
});

function map<T, U>(result: ApiResult<T>, to: (data: T) => U): ApiResult<U> {
  return result.ok ? { ...result, data: to(result.data) } : result;
}

export interface BroadcastListQuery {
  page: number;
  limit: number;
  search?: string;
  filter?: BroadcastFilter;
  /** Broadcasts with ANY of these tags, as on the web. */
  tagIds?: string[];
}

/** The web's tag palette; a tag without a valid colour gets a stable pick from it. */
export const TAG_COLORS = [
  "#10785a",
  "#c28a17",
  "#2f6fd6",
  "#7c4ddb",
  "#d6457f",
  "#d63b3b",
  "#3b6fb6",
];
export const MAX_TAGS = 5;
export function tagColor(name: string, color?: string | null) {
  if (color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/** The web builder's sending pace: a break after this many messages (its choices: 25, 50, 100). */
export const DEFAULT_BATCH = 50;
export const BATCH_OPTIONS = [25, 50, 100] as const;
/** "Send now" goes out this far ahead (the API needs a future time), as on the web. */
export const SEND_NOW_LEAD = SEND_NOW_LEAD_MS;
const SEND_MODE = { now: "NOW", later: "LATER", repeat: "RECURRING" } as const;

/**
 * The multipart body of POST /campaigns and PATCH /campaigns/:id/update, as the web builder sends it. Array
 * fields go as JSON strings, as the API parses them; a draft never carries a send time. An `update` always
 * sends the numbers and saved versions (left out, the API would drop them); `activate` schedules a draft.
 */
export function newBroadcastForm(
  input: NewBroadcastInput,
  { isDraft = false, acknowledgeContactRisk = false, update = false, activate = false } = {},
) {
  const form = new FormData();
  form.append("name", input.name.trim());
  form.append("tagIds", JSON.stringify(input.tagIds));
  form.append("visibility", input.visibility);
  if (input.visibility === "TEAM") {
    form.append("teamIds", JSON.stringify(input.teamIds ?? []));
    form.append("memberIds", JSON.stringify(input.memberIds ?? []));
  }
  const recipients = [
    ...input.audience.rokloGroups.map((group) => ({
      targetType: "ROKLO_GROUP",
      groupId: group.id,
    })),
    ...input.audience.waGroups.map((group) => ({
      targetType: "GROUP",
      groupId: group.id,
    })),
    ...input.audience.contacts.map((contact) => ({
      targetType: "CONTACT",
      contactId: contact.id,
    })),
  ];
  // An empty list can't clear a saved audience; the API keeps it.
  if (recipients.length) form.append("recipients", JSON.stringify(recipients));
  if (input.sessionIds.length || update)
    form.append("sessionIds", JSON.stringify(input.sessionIds));
  // A draft made on the web keeps its template and versions, which mobile doesn't edit.
  if (input.templateId) form.append("templateId", input.templateId);
  form.append("content", input.content);
  form.append("existingFiles", JSON.stringify(input.keepKeys ?? []));
  // Web passes the picked File; native passes { uri, name, type }, which React Native's FormData uploads.
  for (const file of input.files ?? [])
    form.append(
      "files",
      (file.file ?? {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      }) as unknown as Blob,
    );
  if (input.variations?.length || update)
    form.append("variations", JSON.stringify(input.variations ?? []));
  form.append("sendMode", SEND_MODE[input.when]);
  form.append("timezone", input.timezone);
  const repeat = input.when === "repeat" ? input.repeat : undefined;
  form.append("repeatType", repeat?.type ?? "NONE");
  if (repeat) {
    form.append("repeatInterval", String(Math.max(1, repeat.interval)));
    if (repeat.until) form.append("repeatUntil", repeat.until);
    if (repeat.type === "WEEKLY") form.append("weekDays", JSON.stringify(repeat.weekDays));
  }
  if (input.scheduledAt && !isDraft) form.append("scheduledAt", input.scheduledAt);
  form.append("batchSize", String(input.batchSize));
  form.append("batchSizeMax", String(input.batchSize));
  if (isDraft) form.append("isDraft", "true");
  if (activate) form.append("status", "SCHEDULED");
  if (acknowledgeContactRisk) form.append("acknowledgeContactRisk", "true");
  return form;
}

/** A saved file's name, from its storage key or URL. */
export function fileNameOf(key: string) {
  const clean = key.split(/[?#]/)[0];
  const last = clean.slice(clean.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last) || "Attachment";
  } catch {
    return last || "Attachment";
  }
}

/** E09: the API's own list of contacts not saved on the sending WhatsApp account, else null. */
export function unsavedContactsOf(body: unknown) {
  const block = body as { code?: unknown; unsavedContacts?: unknown } | null | undefined;
  if (block?.code !== "E09" || !Array.isArray(block.unsavedContacts)) return null;
  return (
    block.unsavedContacts as {
      id: string;
      name?: string | null;
      mobileNumber?: string | null;
    }[]
  ).map((contact) => ({
    id: contact.id,
    name: contact.name?.trim() || contact.mobileNumber || "Contact",
    phone: contact.mobileNumber ? `+${contact.mobileNumber.replace(/^\+/, "")}` : "",
  }));
}

/** The workspace's broadcasts (roklo-api `/w/:workspaceId/campaigns`), read and changed as the web app does. */
export function createBroadcastsApi(
  request: ReturnType<typeof createApiClient>,
  workspaceId: string,
) {
  const call = <T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> =>
    workspaceId
      ? request<T>(`/w/${encodeURIComponent(workspaceId)}/campaigns${path}`, {
          ...options,
          envelope: false,
        })
      : Promise.resolve({
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        });
  const campaign = (id: string, suffix = "") => `/${encodeURIComponent(id)}${suffix}`;
  // Tags answer in the standard envelope, unlike campaigns.
  const tagsCall = <T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> =>
    workspaceId
      ? request<T>(`/w/${encodeURIComponent(workspaceId)}/tags${path}`, options)
      : Promise.resolve({
          ok: false,
          reason: "failed",
          status: 0,
          message: "Choose a workspace first.",
        });

  async function page(
    query: BroadcastListQuery,
    statuses: BroadcastStatus[],
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      page: String(query.page),
      limit: String(query.limit),
    });
    if (query.search) params.set("name", query.search);
    if (statuses.length) params.set("status", statuses.join(","));
    if (query.tagIds?.length) params.set("tagIds", query.tagIds.join(","));
    return map(await call<ApiCampaignList>(`?${params}`, { signal }), (data): BroadcastPage => ({
      broadcasts: (data.campaigns ?? []).map(toBroadcast),
      total: data.total ?? 0,
      hasMore: data.hasMore ?? false,
    }));
  }
  const patchStatus = (id: string, body: Record<string, unknown>) =>
    call<unknown>(campaign(id, "/update"), { method: "PATCH", body });

  return {
    /**
     * By status tier (Sending, Scheduled, Paused, Draft, …), then newest. Failed and Completed are told apart by
     * the failed count, which the API can't filter on: finished broadcasts are read in full and matched here.
     */
    async list(query: BroadcastListQuery, signal?: AbortSignal): Promise<ApiResult<BroadcastPage>> {
      const filter = query.filter ?? "ALL";
      if (filter === "ALL") return page(query, [], signal);
      if (filter !== "COMPLETED" && filter !== "FAILED") return page(query, [filter], signal);
      const statuses: BroadcastStatus[] =
        filter === "FAILED" ? ["COMPLETED", ...FAILURE_STATUSES] : ["COMPLETED"];
      const shows = (row: Broadcast) =>
        filter === "FAILED" ? FAILURE_STATUSES.includes(row.status) : row.status === "COMPLETED";
      const matches: Broadcast[] = [];
      let more = true;
      for (let next = 1; more && next <= OUTCOME_SCAN_PAGES; next += 1) {
        const result = await page(
          { ...query, page: next, limit: OUTCOME_SCAN_LIMIT },
          statuses,
          signal,
        );
        if (!result.ok) return result;
        matches.push(...result.data.broadcasts.filter(shows));
        more = result.data.hasMore;
      }
      const start = (query.page - 1) * query.limit;
      return {
        ok: true,
        message: "",
        data: {
          broadcasts: matches.slice(start, start + query.limit),
          total: matches.length,
          hasMore: start + query.limit < matches.length,
        },
      };
    },
    /** Broadcasts per status for the same search and tags. */
    counts: (search: string, tagIds: string[] = [], signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (search) params.set("name", search);
      if (tagIds.length) params.set("tagIds", tagIds.join(","));
      const query = params.toString();
      return call<BroadcastCounts>(`/counts${query ? `?${query}` : ""}`, {
        signal,
      });
    },
    summary: async (id: string, signal?: AbortSignal) =>
      map(await call<ApiCampaignDetail>(campaign(id), { signal }), (data): BroadcastSummary => ({
        id: data.id,
        name: data.name,
        status: data.status,
        scheduledAt: data.scheduledAt,
        nextScheduledAt: data.nextRunAt ?? data.scheduledAt,
        timezone: data.timezone || "UTC",
        repeat: toRepeat(data),
        templateName: data.template?.name ?? null,
        totalRecipients: data.totalRecipients ?? 0,
        failed: data.failedRecipients ?? 0,
        stuckDueToCapAt: data.stuckDueToCapAt ?? null,
        hasGroupTargets: data.hasGroupTargets ?? false,
        createdAt: data.createdAt,
      })),
    /** A page of its sends, newest first. */
    runs: async (id: string, pageNumber: number, limit: number, signal?: AbortSignal) =>
      map(
        await call<{ runs: ApiCampaignRun[]; total: number }>(
          campaign(
            id,
            `/runs?${new URLSearchParams({ page: String(pageNumber), limit: String(limit) })}`,
          ),
          { signal },
        ),
        (data): BroadcastRunPage => ({
          runs: (data.runs ?? []).map(toBroadcastRun),
          total: data.total ?? 0,
        }),
      ),
    /** One send, with its delivered and read counts. */
    run: async (id: string, runId: string, signal?: AbortSignal) =>
      map(
        await call<ApiCampaignRun>(campaign(id, `/runs/${encodeURIComponent(runId)}`), { signal }),
        toBroadcastRun,
      ),
    pause: (id: string) => patchStatus(id, { status: "PAUSED" }),
    /** A scheduled or paused broadcast's message, for "Edit message": its text, and how many files go with it. */
    message: async (id: string, signal?: AbortSignal) =>
      map(await call<ApiCampaignDetail>(campaign(id), { signal }), (data) => ({
        name: data.name,
        status: data.status,
        content: data.content ?? "",
        files: (data.files ?? []).length,
      })),
    /** Only the message changes: PATCH /update with the text alone (audience, schedule and files stay). */
    updateMessage: (id: string, content: string) => patchStatus(id, { content }),
    /** Continues where it stopped (after a 10–20 minute break mid-run). */
    resume: (id: string) => patchStatus(id, { status: "SCHEDULED" }),
    /** There's no "send now" endpoint: a scheduled broadcast is moved to a few seconds from now. */
    sendNow: (id: string) =>
      patchStatus(id, {
        scheduledAt: new Date(Date.now() + SEND_NOW_LEAD_MS).toISOString(),
        sendMode: "NOW",
      }),
    /** A new draft named "Copy of …" (its schedule isn't copied). */
    duplicate: (id: string) =>
      call<{ campaignId: string; name: string }>(campaign(id, "/copy"), {
        method: "POST",
        body: {},
      }),
    /** Cancels a broadcast that isn't sending right now, or deletes a draft. */
    remove: (id: string) => call<unknown>(campaign(id), { method: "DELETE" }),
    /** Replaces its tags (up to 5, `[]` clears them), in any status. */
    updateTags: (id: string, tagIds: string[]) =>
      call<unknown>(campaign(id, "/tags"), {
        method: "PATCH",
        body: { tagIds },
      }),
    /** Groups the audience can include, A–Z; WhatsApp ones only those the given numbers are in. */
    availableGroups: async (
      type: "WA" | "ROKLO",
      search: string,
      sessionIds: string[],
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams({ type });
      if (search) params.set("search", search);
      if (sessionIds.length) params.set("sessionIds", sessionIds.join(","));
      return map(
        await call<{ groups: AvailableGroup[] }>(`/available-groups?${params}`, { signal }),
        (data) => data.groups ?? [],
      );
    },
    /** Broadcast tags (module CAMPAIGN: separate from contacts' tags), 100 a page, at most 10 pages. */
    async tags(signal?: AbortSignal): Promise<ApiResult<BroadcastTag[]>> {
      const all: BroadcastTag[] = [];
      for (let page = 0; page < 10; page += 1) {
        const params = new URLSearchParams({
          module: "CAMPAIGN",
          limit: "100",
          offset: String(all.length),
        });
        const result = await tagsCall<{
          tags: { id: string; name: string; color: string | null }[];
          hasMore: boolean;
        }>(`?${params}`, { signal });
        if (!result.ok) return result;
        all.push(
          ...(result.data.tags ?? []).map(({ id, name, color }) => ({
            id,
            name,
            color: tagColor(name, color),
          })),
        );
        if (!result.data.hasMore || !result.data.tags?.length) break;
      }
      return { ok: true, message: "", data: all };
    },
    /** A new broadcast tag. */
    createTag: async (name: string, color: string) =>
      map(
        await tagsCall<{ id: string; name: string; color: string | null }>("", {
          method: "POST",
          body: { name: name.trim(), color, module: "CAMPAIGN" },
        }),
        (tag): BroadcastTag => ({
          id: tag.id,
          name: tag.name,
          color: tagColor(tag.name, tag.color),
        }),
      ),
    /** POST /campaigns: a draft, or a broadcast that sends now or later. */
    create: (
      input: NewBroadcastInput,
      options: { isDraft?: boolean; acknowledgeContactRisk?: boolean } = {},
    ) => save("", "POST", newBroadcastForm(input, options)),
    /** PATCH /campaigns/:id/update: a saved draft changed; `activate` schedules it (now, or at its time). */
    update: (
      id: string,
      input: NewBroadcastInput,
      options: { activate?: boolean; acknowledgeContactRisk?: boolean } = {},
    ) =>
      save(campaign(id, "/update"), "PATCH", newBroadcastForm(input, { ...options, update: true })),
    /** A draft as the builder fills it back in: GET /campaigns/:id, and every page of its targets. */
    async draft(id: string): Promise<ApiResult<BroadcastDraft>> {
      const [detail, targets] = await Promise.all([
        call<ApiCampaignDetail>(campaign(id)),
        allTargets(id),
      ]);
      if (!detail.ok) return detail;
      if (!targets.ok) return targets;
      const data = detail.data;
      const audience: NewAudience = {
        rokloGroups: [],
        waGroups: [],
        contacts: [],
      };
      for (const target of targets.data) {
        if (target.contact && !target.contact.isDeleted) {
          const digits = (target.contact.wahaContactId ?? "").split("@")[0].replace(/\D/g, "");
          const phone = digits ? `+${digits}` : "";
          audience.contacts.push({
            id: target.contact.id,
            name: target.contact.name || phone,
            phone,
          });
        } else if (target.group && !target.group.isDeleted) {
          // Member counts aren't on targets: the private chats line counts them as 0 until re-picked.
          const group = {
            id: target.group.id,
            name: target.group.name,
            memberCount: 0,
          };
          if (target.group.type === "WA") audience.waGroups.push(group);
          else audience.rokloGroups.push(group);
        }
      }
      const visibility =
        data.visibility === "TEAM" || data.visibility === "ME_ONLY"
          ? data.visibility
          : data.visibility === "PRIVATE"
            ? "ME_ONLY"
            : "EVERYONE";
      return {
        ...detail,
        data: {
          id: data.id,
          name: data.name,
          status: data.status,
          sendMode: data.sendMode,
          templateId: data.templateId ?? null,
          content: data.content ?? "",
          attachments: (data.files ?? []).map((key) => ({
            key,
            name: fileNameOf(key),
          })),
          visibility,
          teamIds: (data.accessGrants ?? []).flatMap((grant) =>
            grant.team ? [grant.team.id] : [],
          ),
          memberIds: (data.accessGrants ?? []).flatMap((grant) =>
            !grant.team && grant.user ? [grant.user.id] : [],
          ),
          tagIds: (data.tags ?? []).map((tag) => tag.id),
          sessionIds: (data.campaignSessions ?? []).map((row) => row.sessionId),
          variations: [...(data.variations ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((variation) => variation.content),
          audience,
          scheduledAt: data.scheduledAt,
          nextScheduledAt: data.nextRunAt ?? data.scheduledAt,
          timezone: data.timezone || "UTC",
          repeat: toRepeat(data),
          batchSize: data.batchSizeMax || data.batchSize || DEFAULT_BATCH,
        },
      };
    },
  };

  /** Every target of a broadcast, page by page. */
  async function allTargets(id: string): Promise<ApiResult<ApiTarget[]>> {
    const all: ApiTarget[] = [];
    for (let pageNumber = 1; ; pageNumber += 1) {
      const result = await call<{ targets: ApiTarget[]; total: number }>(
        campaign(id, `/targets?page=${pageNumber}&limit=${TARGETS_PAGE_SIZE}`),
      );
      if (!result.ok) return result;
      const rows = result.data.targets ?? [];
      all.push(...rows);
      if (!rows.length || all.length >= (result.data.total ?? 0))
        return { ok: true, message: "", data: all };
    }
  }

  /** A create or update, as the builder reads it back: done, an E09 block, or an error. */
  async function save(
    path: string,
    method: "POST" | "PATCH",
    body: FormData,
  ): Promise<CreateResult> {
    const result = await call<{
      campaignId?: string;
      id?: string;
      warnings?: string[];
    }>(path, { method, body });
    if (result.ok)
      return {
        ok: true,
        id: result.data?.campaignId ?? result.data?.id ?? "",
        warnings: result.data?.warnings ?? [],
      };
    const unsaved = unsavedContactsOf(result.body);
    if (unsaved) return { ok: false, unsavedContacts: unsaved, message: result.message };
    return {
      ok: false,
      error: result.message || "Couldn't save the broadcast. Try again.",
    };
  }
}
export type BroadcastsApi = ReturnType<typeof createBroadcastsApi>;
