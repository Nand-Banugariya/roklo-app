import assert from "node:assert/strict";
import "./register-typescript.mjs";
import { test } from "node:test";
import { createApiClient } from "../src/services/api/create-client.ts";
import { createMessagingApi } from "../src/features/messaging/services/messaging-api.ts";
import {
  defaultSchedule,
  scheduleDate,
  scheduleDays,
  scheduleError,
  scheduleTimestamp,
} from "../src/features/messaging/utils/scheduling.ts";

test("scheduling rejects invalid, past, too-soon and out-of-window instants", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  for (const date of [null, new Date(NaN), now, new Date(now.getTime() + 59_999)])
    assert.ok(scheduleError(date, now));
  assert.equal(scheduleError(new Date(now.getTime() + 60_000), now), null);
  assert.equal(scheduleError(new Date(now.getTime() + 30 * 86400_000), now), null);
  assert.ok(scheduleError(new Date(now.getTime() + 30 * 86400_000 + 1), now));
});

test("date wheels cross years, default past midnight and distinguish noon from midnight", () => {
  const now = new Date(2026, 11, 31, 23, 45, 30);
  const days = scheduleDays(now);
  assert.equal(days.length, 31);
  assert.equal(days[1].getFullYear(), 2027);
  assert.equal(days[1].getMonth(), 0);
  assert.equal(defaultSchedule(now).getDate(), 1);
  assert.equal(defaultSchedule(now).getMinutes(), 45);
  assert.equal(defaultSchedule(now).getSeconds(), 0);
  assert.equal(scheduleDate(days[1], 12, 0, "AM").getHours(), 0);
  assert.equal(scheduleDate(days[1], 12, 0, "PM").getHours(), 12);
  assert.equal(scheduleDate(days[1], 9, 15, "PM").getHours(), 21);
});

test("scheduling uses the picked date's UTC offset and rejects skipped DST clock times", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(scheduleDate(new Date(2026, 2, 8), 2, 30, "AM"), null);
    assert.match(scheduleTimestamp(new Date(2026, 0, 15, 9)), /09:00:00-05:00$/);
    assert.match(scheduleTimestamp(new Date(2026, 6, 15, 9)), /09:00:00-04:00$/);
    process.env.TZ = "Asia/Kolkata";
    const date = new Date(2026, 9, 26, 9, 5);
    assert.equal(scheduleTimestamp(date), "2026-10-26T09:05:00+05:30");
    assert.equal(Date.parse(scheduleTimestamp(date)), date.getTime());
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("scheduled replies upload text, attachments, quote and absolute time to the scoped API", async () => {
  const calls = [];
  const date = new Date("2026-10-27T09:00:00+05:30");
  const queued = {
    id: "scheduled",
    conversationId: "chat/a",
    status: "PENDING",
    scheduledAt: date.toISOString(),
  };
  const request = createApiClient({
    baseUrl: "https://example.test",
    getToken: () => "token",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(queued), { status: 201 });
    },
  });
  const api = createMessagingApi(request, "workspace/a");
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  assert.deepEqual(
    (
      await api.schedule(
        "chat/a",
        "Hello later",
        [{ uri: "blob:1", name: file.name, mimeType: file.type, file }],
        date,
        "quote",
      )
    ).data,
    queued,
  );
  assert.equal(
    calls[0].url,
    "https://example.test/w/workspace%2Fa/inbox/conversations/chat%2Fa/scheduled-messages",
  );
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token");
  assert.equal(
    calls[0].options.headers["Content-Type"],
    undefined,
    "Fetch must provide the multipart boundary",
  );
  const body = calls[0].options.body;
  assert.equal(body.get("text"), "Hello later");
  assert.equal(body.get("replyToMessageId"), "quote");
  assert.equal(body.getAll("files")[0].name, "photo.png");
  assert.equal(Date.parse(body.get("scheduledAt")), date.getTime());
  assert.equal(body.get("timezone"), Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(body.get("type"), null, "Scheduling creates a reply, never a private note");
  await api.schedule(
    "chat/a",
    "",
    [{ uri: "blob:1", name: file.name, mimeType: file.type, file }],
    date,
  );
  assert.equal(calls[1].options.body.get("text"), null);
  assert.equal(calls[1].options.body.getAll("files").length, 1);
});

test("scheduled list and mutations preserve scoping, pagination, cancellation and server failures", async () => {
  const calls = [];
  const failure = {
    ok: false,
    reason: "failed",
    status: 403,
    message: "You cannot manage this message.",
  };
  const api = createMessagingApi(async (path, options) => {
    calls.push({ path, options });
    return failure;
  }, "workspace");
  const controller = new AbortController();
  assert.deepEqual(await api.scheduled("chat/a", 2, controller.signal), failure);
  const url = new URL(`https://example.test${calls[0].path}`);
  assert.equal(url.pathname, "/w/workspace/inbox/conversations/chat%2Fa/scheduled-messages");
  assert.equal(url.searchParams.get("status"), "PENDING,PROCESSING,FAILED");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.envelope, false);
  await api.cancelScheduled("message/a");
  await api.sendScheduledNow("message/a");
  await api.retryScheduled("message/a");
  assert.equal(calls[1].options.method, "DELETE");
  assert.equal(calls[1].path, "/w/workspace/inbox/scheduled-messages/message%2Fa");
  assert.match(calls[2].path, /message%2Fa\/send-now$/);
  assert.equal(calls[2].options.method, "POST");
  assert.match(calls[3].path, /message%2Fa\/retry$/);
  assert.deepEqual(calls[3].options.body, {});
  const unscoped = createMessagingApi(async () => {
    throw new Error("Must not call an unscoped API");
  }, "");
  assert.equal((await unscoped.schedule("chat", "hi", [], new Date())).ok, false);
});
