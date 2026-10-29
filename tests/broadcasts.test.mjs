import assert from "node:assert/strict";
import "./register-typescript.mjs";
import { test } from "node:test";
import {
  createBroadcastsApi,
  outcomeStatus,
  toBroadcast,
  toBroadcastRun,
} from "../src/features/broadcasts/services/broadcasts-api.ts";
import {
  formatWhen,
  isRepeatEnded,
  pauseReasonLabel,
  percent,
  plannedOf,
  repeatLabel,
  replyRate,
  rowDetail,
  runDuration,
} from "../src/features/broadcasts/utils/broadcast-format.ts";

const campaign = (overrides = {}) => ({
  id: "b1",
  name: "Diwali offer",
  status: "COMPLETED",
  sendMode: "LATER",
  scheduledAt: "2026-10-20T04:30:00.000Z",
  timezone: "Asia/Kolkata",
  repeatType: "NONE",
  repeatInterval: null,
  repeatUntil: null,
  weekDays: [],
  totalRecipients: 120,
  failedRecipients: 0,
  lastRunAt: null,
  nextRunAt: null,
  stuckDueToCapAt: null,
  createdAt: "2026-10-19T10:00:00.000Z",
  template: { id: "t1", name: "Festive" },
  nextScheduledAt: null,
  tags: [{ id: "g1", name: "Promo", color: "#f00" }],
  stats: {
    sentCount: 118,
    deliveredCount: 110,
    repliedCount: 9,
    totalTargets: 120,
    sessionName: "session-a",
  },
  ...overrides,
});
const repeat = (overrides = {}) => ({
  type: "NONE",
  interval: null,
  weekDays: [],
  until: null,
  ...overrides,
});

test("finished broadcasts read Failed or Partly sent from their failed count, as on the web", () => {
  assert.equal(outcomeStatus("COMPLETED", 10, 0), "COMPLETED");
  assert.equal(outcomeStatus("COMPLETED", 10, 2), "PARTIALLY_COMPLETED");
  assert.equal(outcomeStatus("COMPLETED", 0, 5), "FAILED");
  assert.equal(outcomeStatus("RUNNING", 0, 5), "RUNNING");
});

test("list rows map the API's stats, tags and a one-off's send time", () => {
  const row = toBroadcast(campaign({ failedRecipients: 2 }));
  assert.equal(row.status, "PARTIALLY_COMPLETED");
  assert.deepEqual(
    [row.sent, row.delivered, row.replied, row.failed, row.targets],
    [118, 110, 9, 2, 120],
  );
  assert.equal(row.templateName, "Festive");
  assert.equal(row.sessionName, "session-a");
  assert.deepEqual(row.tags, [{ id: "g1", name: "Promo", color: "#f00" }]);
  // No lastRunAt: a one-off that went out did so at its scheduled time.
  assert.equal(row.lastSentAt, "2026-10-20T04:30:00.000Z");
  const draft = toBroadcast(
    campaign({ status: "DRAFT", stats: null, template: null, tags: undefined }),
  );
  assert.deepEqual(
    [draft.sent, draft.lastSentAt, draft.templateName, draft.tags],
    [0, null, null, []],
  );
  assert.equal(plannedOf({ targets: 0, totalRecipients: 50 }), 50);
});

test("broadcast requests are workspace scoped, without the envelope, and change status as the web app does", async () => {
  const calls = [];
  const api = createBroadcastsApi(async (path, options) => {
    calls.push({ path, options });
    return {
      ok: true,
      message: "",
      data: path.includes("/runs")
        ? { runs: [], total: 0 }
        : { campaigns: [], total: 0, hasMore: false },
    };
  }, "team/west");
  await api.list({ page: 2, limit: 20, search: "diwali", filter: "SCHEDULED" });
  await api.counts("diwali");
  await api.runs("b/1", 1, 10);
  await api.pause("b/1");
  await api.resume("b/1");
  await api.sendNow("b/1");
  await api.duplicate("b/1");
  await api.remove("b/1");
  assert.equal(
    calls[0].path,
    "/w/team%2Fwest/campaigns?page=2&limit=20&name=diwali&status=SCHEDULED",
  );
  assert.equal(calls[1].path, "/w/team%2Fwest/campaigns/counts?name=diwali");
  assert.equal(calls[2].path, "/w/team%2Fwest/campaigns/b%2F1/runs?page=1&limit=10");
  assert.ok(calls.every((call) => call.options.envelope === false));
  assert.deepEqual(
    calls
      .slice(3)
      .map((call) => [
        call.options.method ?? "GET",
        call.path.replace("/w/team%2Fwest/campaigns", ""),
      ]),
    [
      ["PATCH", "/b%2F1/update"],
      ["PATCH", "/b%2F1/update"],
      ["PATCH", "/b%2F1/update"],
      ["POST", "/b%2F1/copy"],
      ["DELETE", "/b%2F1"],
    ],
  );
  assert.deepEqual(calls[3].options.body, { status: "PAUSED" });
  assert.deepEqual(calls[4].options.body, { status: "SCHEDULED" });
  assert.equal(calls[5].options.body.sendMode, "NOW");
  assert.ok(new Date(calls[5].options.body.scheduledAt).getTime() > Date.now());
});

test("the Failed filter reads finished broadcasts and keeps only those with failures", async () => {
  const rows = [
    campaign({ id: "ok" }),
    campaign({ id: "partly", failedRecipients: 3 }),
    campaign({ id: "none", failedRecipients: 5, stats: null }),
    campaign({ id: "old", status: "FAILED" }),
  ];
  const paths = [];
  const api = createBroadcastsApi(async (path) => {
    paths.push(path);
    return { ok: true, message: "", data: { campaigns: rows, total: rows.length, hasMore: false } };
  }, "w");
  const failed = await api.list({ page: 1, limit: 20, filter: "FAILED" });
  assert.deepEqual(
    failed.data.broadcasts.map((row) => row.id),
    ["partly", "none", "old"],
  );
  assert.equal(failed.data.total, 3);
  assert.match(decodeURIComponent(paths[0]), /status=COMPLETED,FAILED,PARTIALLY_COMPLETED/);
  const completed = await api.list({ page: 1, limit: 20, filter: "COMPLETED" });
  assert.deepEqual(
    completed.data.broadcasts.map((row) => row.id),
    ["ok"],
  );
  assert.equal(
    (
      await createBroadcastsApi(async () => {
        throw new Error("no request");
      }, "").counts("")
    ).ok,
    false,
  );
});

test("dates, repeats and a card's status line read like the web app's", () => {
  const now = new Date(2026, 9, 27, 12, 0);
  assert.equal(formatWhen(new Date(2026, 9, 27, 17, 5).toISOString(), { now }), "Today, 17:05");
  assert.equal(formatWhen(new Date(2026, 9, 28, 9, 30).toISOString(), { now }), "Tomorrow, 09:30");
  assert.equal(
    formatWhen(new Date(2026, 9, 9, 10, 0).toISOString(), { now, weekday: true }),
    "Fri 9 Oct, 10:00",
  );
  assert.equal(
    formatWhen(new Date(2025, 8, 20, 18, 0).toISOString(), { now }),
    "20 Sep 2025, 18:00",
  );
  assert.equal(formatWhen(null), "");
  assert.equal(repeatLabel(repeat({ type: "DAILY", interval: 1 }), null), "Every day");
  assert.equal(
    repeatLabel(repeat({ type: "WEEKLY", interval: 1, weekDays: ["FRIDAY"] }), null),
    "Every Friday",
  );
  assert.equal(
    repeatLabel(repeat({ type: "WEEKLY", interval: 2, weekDays: ["MONDAY", "THURSDAY"] }), null),
    "Every 2 weeks on Mon, Thu",
  );
  assert.equal(
    repeatLabel(repeat({ type: "MONTHLY", interval: 1 }), new Date(2026, 9, 2, 10).toISOString()),
    "Monthly on the 2nd",
  );
  assert.equal(repeatLabel(repeat(), null), "");
  assert.equal(isRepeatEnded(repeat({ type: "DAILY", until: "2026-10-26" }), now), true);
  assert.equal(isRepeatEnded(repeat({ type: "DAILY", until: "2026-10-27" }), now), false);
  assert.equal(isRepeatEnded(repeat({ until: "2020-01-01" }), now), false);
  const row = toBroadcast(
    campaign({
      status: "RUNNING",
      stats: {
        sentCount: 1234,
        deliveredCount: 0,
        repliedCount: 0,
        totalTargets: 5000,
        sessionName: null,
      },
    }),
  );
  assert.equal(rowDetail(row, now), "1,234 / 5,000 sent");
  assert.equal(rowDetail({ ...row, status: "DRAFT" }, now), "Not scheduled yet");
  assert.equal(
    rowDetail(
      { ...row, status: "SCHEDULED", nextScheduledAt: new Date(2026, 9, 28, 9, 0).toISOString() },
      now,
    ),
    "Next Tomorrow, 09:00",
  );
  assert.equal(percent(1, 3), "33%");
  assert.equal(percent(1, 0), "");
});

test("runs: pause reasons, reply rate after 25 sent, and how long they took", () => {
  const run = toBroadcastRun({
    id: "r1",
    campaignId: "b1",
    runNumber: 2,
    status: "PAUSED",
    sentCount: 40,
    failedCount: 1,
    pendingCount: 79,
    totalTargets: 120,
    replyCount: 2,
    createdAt: "2026-10-27T10:00:00.000Z",
    startedAt: "2026-10-27T10:00:00.000Z",
    completedAt: "2026-10-27T12:05:00.000Z",
    pausedAt: null,
    pauseReason: "reply_rate",
    ghostFlagged: false,
    ghostPausedUntil: null,
    stuckDueToCapAt: null,
  });
  assert.deepEqual([run.delivered, run.read], [null, null]);
  assert.equal(pauseReasonLabel(run), "Reply rate too low");
  assert.equal(pauseReasonLabel({ pauseReason: null, ghostFlagged: true }), "Too many undelivered");
  assert.equal(pauseReasonLabel({ pauseReason: null, ghostFlagged: false }), "Paused by your team");
  assert.equal(replyRate(run), 0.05);
  assert.equal(replyRate({ sent: 24, replied: 10 }), null);
  assert.equal(runDuration(run), "2h 5m");
  assert.equal(runDuration({ startedAt: null, completedAt: null }), null);
});

test("a new broadcast posts the web builder's multipart body: recipients, numbers, send mode, repeat and pacing", async () => {
  const { newBroadcastForm } =
    await import("../src/features/broadcasts/services/broadcasts-api.ts");
  const input = {
    name: "  Diwali offer ",
    tagIds: ["t1"],
    visibility: "ME_ONLY",
    content: "Hello!",
    sessionIds: ["n1", "n2"],
    timezone: "Asia/Kolkata",
    batchSize: 25,
    when: "now",
    scheduledAt: "2026-10-27T10:00:15.000Z",
    audience: {
      rokloGroups: [{ id: "g1", name: "VIP", memberCount: 40 }],
      waGroups: [{ id: "w1", name: "Team", memberCount: 9 }],
      contacts: [{ id: "c1", name: "Asha", phone: "" }],
    },
  };
  const now = newBroadcastForm(input);
  assert.equal(now.get("name"), "Diwali offer");
  assert.deepEqual(
    [now.get("sendMode"), now.get("scheduledAt"), now.get("visibility")],
    ["NOW", "2026-10-27T10:00:15.000Z", "ME_ONLY"],
  );
  assert.deepEqual(JSON.parse(now.get("recipients")), [
    { targetType: "ROKLO_GROUP", groupId: "g1" },
    { targetType: "GROUP", groupId: "w1" },
    { targetType: "CONTACT", contactId: "c1" },
  ]);
  assert.deepEqual(JSON.parse(now.get("sessionIds")), ["n1", "n2"]);
  assert.deepEqual(
    [JSON.parse(now.get("tagIds")), now.get("teamIds"), now.get("memberIds")],
    [["t1"], null, null],
  );
  const team = newBroadcastForm({
    ...input,
    visibility: "TEAM",
    teamIds: ["team1"],
    memberIds: ["u1", "u2"],
  });
  assert.deepEqual(
    [team.get("visibility"), JSON.parse(team.get("teamIds")), JSON.parse(team.get("memberIds"))],
    ["TEAM", ["team1"], ["u1", "u2"]],
  );
  assert.deepEqual(
    [
      now.get("repeatType"),
      now.get("repeatInterval"),
      now.get("batchSize"),
      now.get("batchSizeMax"),
      now.get("isDraft"),
    ],
    ["NONE", null, "25", "25", null],
  );
  const later = newBroadcastForm(
    { ...input, when: "later", scheduledAt: "2026-10-28T03:30:00.000Z" },
    { acknowledgeContactRisk: true },
  );
  assert.deepEqual(
    [later.get("sendMode"), later.get("scheduledAt"), later.get("acknowledgeContactRisk")],
    ["LATER", "2026-10-28T03:30:00.000Z", "true"],
  );
  const weekly = newBroadcastForm({
    ...input,
    when: "repeat",
    repeat: { type: "WEEKLY", interval: 2, weekDays: ["MONDAY", "FRIDAY"], until: "2026-12-31" },
  });
  assert.deepEqual(
    [
      weekly.get("sendMode"),
      weekly.get("repeatType"),
      weekly.get("repeatInterval"),
      weekly.get("repeatUntil"),
      JSON.parse(weekly.get("weekDays")),
    ],
    ["RECURRING", "WEEKLY", "2", "2026-12-31", ["MONDAY", "FRIDAY"]],
  );
  const daily = newBroadcastForm({
    ...input,
    when: "repeat",
    repeat: { type: "DAILY", interval: 0, weekDays: ["MONDAY"], until: null },
  });
  assert.deepEqual(
    [daily.get("repeatInterval"), daily.get("repeatUntil"), daily.get("weekDays")],
    ["1", null, null],
  );
  // A draft never carries a send time, and an empty audience or no numbers aren't sent at all.
  const draft = newBroadcastForm(
    { ...input, sessionIds: [], audience: { rokloGroups: [], waGroups: [], contacts: [] } },
    { isDraft: true },
  );
  assert.deepEqual(
    [
      draft.get("isDraft"),
      draft.get("scheduledAt"),
      draft.get("recipients"),
      draft.get("sessionIds"),
    ],
    ["true", null, null, null],
  );
});

test("creating reads the new id, turns E09 into the unsaved-contacts list, and lists groups by type and number", async () => {
  const calls = [];
  const replies = [
    { ok: true, message: "", data: { campaignId: "new-1", warnings: ["Slow down"] } },
    {
      ok: false,
      reason: "failed",
      status: 400,
      message: "Some contacts aren't saved",
      body: {
        code: "E09",
        unsavedContacts: [{ id: "c9", name: "", mobileNumber: "919876543210" }],
      },
    },
    { ok: false, reason: "failed", status: 403, message: "No access" },
    {
      ok: true,
      message: "",
      data: {
        groups: [
          {
            id: "w1",
            name: "Team",
            type: "WA",
            memberCount: 9,
            isAnnounce: false,
            isAdminSession: true,
          },
        ],
      },
    },
  ];
  const api = createBroadcastsApi(async (path, options) => {
    calls.push({ path, options });
    return replies.shift();
  }, "w");
  const input = {
    name: "x",
    tagIds: [],
    visibility: "EVERYONE",
    content: "y",
    sessionIds: [],
    when: "now",
    batchSize: 50,
    timezone: "UTC",
    audience: { rokloGroups: [], waGroups: [], contacts: [] },
  };
  assert.deepEqual(await api.create(input), { ok: true, id: "new-1", warnings: ["Slow down"] });
  assert.deepEqual(await api.create(input), {
    ok: false,
    message: "Some contacts aren't saved",
    unsavedContacts: [{ id: "c9", name: "919876543210", phone: "+919876543210" }],
  });
  assert.deepEqual(await api.create(input), { ok: false, error: "No access" });
  const groups = await api.availableGroups("WA", "team", ["n1", "n2"]);
  assert.equal(groups.data[0].name, "Team");
  assert.deepEqual([calls[0].options.method, calls[0].path], ["POST", "/w/w/campaigns"]);
  assert.equal(
    decodeURIComponent(calls[3].path),
    "/w/w/campaigns/available-groups?type=WA&search=team&sessionIds=n1,n2",
  );
});

test("broadcast tags come from the CAMPAIGN module in the standard envelope, page by page, with the web's colours", async () => {
  const { tagColor, TAG_COLORS } =
    await import("../src/features/broadcasts/services/broadcasts-api.ts");
  const calls = [];
  const pages = [
    {
      ok: true,
      message: "",
      data: {
        tags: [
          { id: "t1", name: "Promo", color: "#ff0000" },
          { id: "t2", name: "Festive", color: null },
        ],
        hasMore: true,
      },
    },
    {
      ok: true,
      message: "",
      data: { tags: [{ id: "t3", name: "VIP", color: "bad" }], hasMore: false },
    },
    { ok: true, message: "", data: { id: "t4", name: "New", color: "#2f6fd6" } },
  ];
  const api = createBroadcastsApi(async (path, options = {}) => {
    calls.push({ path, options });
    return pages.shift();
  }, "w");
  const tags = await api.tags();
  assert.deepEqual(
    tags.data.map((tag) => [tag.id, tag.color]),
    [
      ["t1", "#ff0000"],
      ["t2", tagColor("Festive")],
      ["t3", tagColor("VIP")],
    ],
  );
  assert.ok(TAG_COLORS.includes(tagColor("Festive")));
  assert.equal(calls[0].path, "/w/w/tags?module=CAMPAIGN&limit=100&offset=0");
  assert.equal(calls[1].path, "/w/w/tags?module=CAMPAIGN&limit=100&offset=2");
  // Tags answer in the envelope, so the client unwraps them (campaigns don't).
  assert.equal(calls[0].options.envelope, undefined);
  const created = await api.createTag("  New ", "#2f6fd6");
  assert.deepEqual(created.data, { id: "t4", name: "New", color: "#2f6fd6" });
  assert.deepEqual(
    [calls[2].options.method, calls[2].path, calls[2].options.body],
    ["POST", "/w/w/tags", { name: "New", color: "#2f6fd6", module: "CAMPAIGN" }],
  );
});

test("an update keeps a draft's numbers, versions and saved files, and activate schedules it", async () => {
  const { newBroadcastForm } =
    await import("../src/features/broadcasts/services/broadcasts-api.ts");
  const input = {
    name: "Draft",
    tagIds: [],
    visibility: "EVERYONE",
    content: "Hi",
    sessionIds: [],
    timezone: "Asia/Kolkata",
    batchSize: 50,
    when: "now",
    audience: { rokloGroups: [], waGroups: [], contacts: [] },
    keepKeys: ["w/1/offer.pdf"],
    templateId: "t1",
    variations: [],
  };
  const update = newBroadcastForm(input, { update: true });
  // Left out, the API would drop the numbers and the saved versions.
  assert.deepEqual(
    [JSON.parse(update.get("sessionIds")), JSON.parse(update.get("variations"))],
    [[], []],
  );
  assert.deepEqual(
    [JSON.parse(update.get("existingFiles")), update.get("templateId"), update.get("status")],
    [["w/1/offer.pdf"], "t1", null],
  );
  const send = newBroadcastForm(
    { ...input, variations: ["Hello"] },
    { update: true, activate: true },
  );
  assert.deepEqual(
    [send.get("status"), JSON.parse(send.get("variations"))],
    ["SCHEDULED", ["Hello"]],
  );
  // A new broadcast sends no empty lists and keeps nothing.
  const create = newBroadcastForm({ ...input, keepKeys: undefined, templateId: null });
  assert.deepEqual(
    [
      create.get("sessionIds"),
      create.get("variations"),
      JSON.parse(create.get("existingFiles")),
      create.get("templateId"),
    ],
    [null, null, [], null],
  );
});

test("a draft reopens with its audience from every page of targets, its access, versions and files", async () => {
  const paths = [];
  const targetPages = {
    1: {
      targets: [
        {
          targetType: "CONTACT",
          contact: { id: "c1", name: "Asha", wahaContactId: "919820055310@c.us", isDeleted: false },
          group: null,
        },
        {
          targetType: "CONTACT",
          contact: { id: "c2", name: "Gone", wahaContactId: null, isDeleted: true },
          group: null,
        },
      ],
      total: 3,
    },
    2: {
      targets: [
        {
          targetType: "GROUP",
          contact: null,
          group: { id: "w1", name: "Team", type: "WA", isDeleted: false },
        },
      ],
      total: 3,
    },
  };
  const api = createBroadcastsApi(async (path) => {
    paths.push(path);
    const page = /\/targets\?page=(\d+)/.exec(path)?.[1];
    if (page) return { ok: true, message: "", data: targetPages[page] };
    return {
      ok: true,
      message: "",
      data: campaign({
        status: "DRAFT",
        sendMode: "LATER",
        content: "Hello {{name}}",
        files: ["w/1/menu%20card.pdf"],
        visibility: "PRIVATE",
        accessGrants: [
          { team: { id: "team1", name: "Sales" }, user: null },
          { team: null, user: { id: "u1", name: "Ravi" } },
        ],
        campaignSessions: [{ sessionId: "n1" }],
        variations: [
          { content: "B", position: 1 },
          { content: "A", position: 0 },
        ],
        templateId: "t1",
        batchSize: 25,
        batchSizeMax: 40,
      }),
    };
  }, "w");
  const result = await api.draft("b1");
  assert.ok(result.ok);
  const draft = result.data;
  assert.deepEqual(draft.audience, {
    rokloGroups: [],
    waGroups: [{ id: "w1", name: "Team", memberCount: 0 }],
    contacts: [{ id: "c1", name: "Asha", phone: "+919820055310" }],
  });
  assert.deepEqual(
    [draft.visibility, draft.teamIds, draft.memberIds],
    ["ME_ONLY", ["team1"], ["u1"]],
  );
  assert.deepEqual(
    [draft.variations, draft.attachments, draft.sessionIds, draft.batchSize, draft.templateId],
    [["A", "B"], [{ key: "w/1/menu%20card.pdf", name: "menu card.pdf" }], ["n1"], 40, "t1"],
  );
  assert.equal(paths.filter((path) => path.includes("/targets")).length, 2);
});
