import assert from "node:assert/strict";
import "./register-typescript.mjs";
import { test } from "node:test";
import { createApiClient } from "../src/services/api/create-client.ts";
import { createMessagingApi } from "../src/features/messaging/services/messaging-api.ts";
import { chooseNumber, connectionState, isConnected, numberName, numberPhone } from "../src/features/messaging/types.ts";

const number = (id, connected = true) => ({ id, status: connected ? "WORKING" : "STOPPED", isWhatsAppConnected: connected });

test("a stale connected flag cannot enable replies after the session stops", () => {
  assert.equal(isConnected({ ...number("sales"), status: "STOPPED" }), false);
  assert.equal(isConnected(number("sales")), true);
});

test("connection state separates reconnecting, disconnected and never-linked numbers", () => {
  assert.equal(connectionState({ ...number("sales"), phoneNumber: "919876543210" }), "connected");
  assert.equal(connectionState({ ...number("sales", false), status: "STARTING", phoneNumber: "919876543210" }), "connecting");
  assert.equal(connectionState({ ...number("sales", false), phoneNumber: "919876543210" }), "disconnected");
  assert.equal(connectionState({ ...number("sales", false), phoneNumber: null }), "unlinked");
});

test("number phones use international grouping and fall back to E.164", () => {
  assert.equal(numberPhone({ phoneNumber: "919876543210" }), "+91 98765 43210");
  assert.equal(numberName({ displayName: null, phoneNumber: "+919876543210" }), "+91 98765 43210");
  assert.equal(numberPhone({ phoneNumber: "123" }), "+123");
  assert.equal(numberPhone({ phoneNumber: null }), "Not linked yet");
});

test("number selection retains a remembered disconnected number instead of silently switching senders", () => {
  const rows = [number("sales"), number("support", false)];
  assert.equal(chooseNumber(rows, "support").id, "support");
  assert.equal(chooseNumber(rows, "removed").id, "sales");
  assert.equal(chooseNumber([rows[1]], null).id, "support");
  assert.equal(chooseNumber([], "sales"), null);
});

test("chat queries always scope to one number, safely encode workspace IDs, and cancel stale requests", async () => {
  const calls = [];
  const controller = new AbortController();
  const api = createMessagingApi(async (path, options) => { calls.push({ path, options }); return { ok: true, data: {}, message: "" }; }, "team/west");
  await api.conversations("sales/one", "unread", "Ananya +91", 2, controller.signal);
  const query = new URL(`https://example.test${calls[0].path}`);
  assert.equal(query.pathname, "/w/team%2Fwest/inbox/conversations");
  assert.equal(query.searchParams.get("sessionId"), "sales/one");
  assert.equal(query.searchParams.get("category"), "unread");
  assert.equal(query.searchParams.get("search"), "Ananya +91");
  assert.equal(query.searchParams.get("page"), "2");
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.envelope, false);
  assert.throws(() => api.conversations("", "all", "", 1), /Choose a WhatsApp number/);
  assert.equal(calls.length, 1);
});

test("a missing workspace never issues a request against an unscoped endpoint", async () => {
  let calls = 0;
  const api = createMessagingApi(async () => { calls++; throw new Error("Should not request"); }, "");
  const result = await api.numbers();
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test("phone-number linking uses pairing-code endpoint and does not request QR data", async () => {
  const calls = [];
  const api = createMessagingApi(async (path, options) => { calls.push({ path, options }); return { ok: true, data: { code: "ABCD1234" }, message: "" }; }, "workspace");
  const result = await api.pairingCode("number/1", "+919876543210");
  assert.equal(result.data.code, "ABCD1234");
  assert.equal(calls[0].path, "/w/workspace/whatsapp/sessions/number%2F1/pairing-code");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(calls[0].options.body, { phoneNumber: "+919876543210" });
});

test("inbox bare responses preserve pagination while ordinary API envelopes still unwrap", async () => {
  const body = { data: [{ id: "chat" }], total: 1, limit: 30, page: 1 };
  const request = createApiClient({ baseUrl: "https://example.test", getToken: () => "token",
    fetch: async () => new Response(JSON.stringify(body), { status: 200 }) });
  const result = await request("/inbox", { envelope: false });
  assert.deepEqual(result.data, body);
  assert.equal((await request("/ordinary")).ok, false);
  const standard = createApiClient({ baseUrl: "https://example.test", getToken: () => "token",
    fetch: async () => new Response(JSON.stringify({ success: true, data: body }), { status: 200 }) });
  assert.deepEqual((await standard("/ordinary")).data, body);
});

test("bare inbox endpoints still reject unauthorized replies and invalidate the used session", async () => {
  const invalidated = [];
  const request = createApiClient({ baseUrl: "https://example.test", getToken: () => "expired",
    onUnauthorized: (token) => invalidated.push(token),
    fetch: async () => new Response(JSON.stringify({ message: "Session expired" }), { status: 401 }) });
  const result = await request("/inbox", { envelope: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.deepEqual(invalidated, ["expired"]);
});

test("replies use multipart text and never default to a different conversation", async () => {
  const calls = [];
  const api = createMessagingApi(async (path, options) => { calls.push({ path, options }); return { ok: true, data: {}, message: "" }; }, "workspace");
  await api.send("chat/one", "Hello Ananya");
  assert.equal(calls[0].path, "/w/workspace/inbox/conversations/chat%2Fone/messages");
  assert.equal(calls[0].options.body.get("text"), "Hello Ananya");
  assert.equal(calls[0].options.body.get("type"), "REPLY");
  assert.equal(calls[0].options.envelope, false);
});

test("private notes are text only, and reply attachments go up as repeated files fields", async () => {
  const calls = [];
  const api = createMessagingApi(async (path, options) => { calls.push({ path, options }); return { ok: true, data: {}, message: "" }; }, "workspace");
  const photo = new File(["x"], "photo.png", { type: "image/png" });
  await api.send("chat", "Called back", "PRIVATE_NOTE", [{ uri: "blob:1", name: "photo.png", mimeType: "image/png", file: photo }]);
  assert.equal(calls[0].options.body.get("type"), "PRIVATE_NOTE");
  assert.equal(calls[0].options.body.getAll("files").length, 0);
  await api.send("chat", "", "REPLY", [{ uri: "blob:1", name: "photo.png", mimeType: "image/png", file: photo },
    { uri: "blob:2", name: "menu.pdf", mimeType: "application/pdf", file: new File(["y"], "menu.pdf", { type: "application/pdf" }) }]);
  assert.equal(calls[1].options.body.get("text"), null, "an attachment-only reply sends no empty text");
  assert.deepEqual(calls[1].options.body.getAll("files").map((file) => file.name), ["photo.png", "menu.pdf"]);
});

test("media URLs are sorted into photos, videos, audio and documents like WhatsApp, with readable names", async () => {
  const { attachmentKind, attachmentName, attachmentExtension, isWebUrl } = await import("../src/features/messaging/utils/attachments.ts");
  assert.equal(attachmentKind("https://cdn.example/a/photo.JPG?sig=1"), "image");
  assert.equal(attachmentKind("https://cdn.example/clip.mp4"), "video");
  assert.equal(attachmentKind("https://cdn.example/voice.opus"), "audio");
  assert.equal(attachmentKind("https://cdn.example/menu.pdf"), "file");
  assert.equal(attachmentKind("https://cdn.example/media/8f2c1a", "clip.mp4"), "video", "a URL without an extension uses the file name");
  assert.equal(attachmentName("https://cdn.example/abc123__Menu%20card.pdf"), "Menu card.pdf");
  assert.equal(attachmentName("https://cdn.example/x.pdf", "Invoice.pdf"), "Invoice.pdf");
  assert.equal(attachmentName("https://cdn.example/%E0%A4bad"), "%E0%A4bad", "a broken escape keeps the raw name");
  assert.equal(attachmentExtension("Menu card.pdf"), "PDF");
  assert.equal(isWebUrl("javascript:alert(1)"), false);
});

test("live inbox calls: one message by id, and typing state for the open chat", async () => {
  const calls = [];
  const api = createMessagingApi(async (path, options) => { calls.push({ path, options }); return { ok: true, data: {}, message: "" }; }, "workspace");
  await api.message("chat/one", "msg 1");
  assert.equal(calls[0].path, "/w/workspace/inbox/conversations/chat%2Fone/messages/msg%201");
  assert.equal(calls[0].options.envelope, false);
  api.setTyping("chat", "typing");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls[1].path, "/w/workspace/inbox/conversations/chat/typing");
  assert.deepEqual(calls[1].options.body, { state: "typing" });
  assert.equal(calls[1].options.method, "POST");
});

test("only one audio or video plays at a time: starting another pauses the first", async () => {
  const { claimPlayback, releasePlayback } = await import("../src/features/messaging/utils/playback.ts");
  const paused = [];
  claimPlayback("audio:a", () => paused.push("audio:a"));
  claimPlayback("audio:a", () => paused.push("audio:a"));
  assert.deepEqual(paused, [], "the same player claiming again pauses nothing");
  claimPlayback("video:b", () => paused.push("video:b"));
  assert.deepEqual(paused, ["audio:a"]);
  releasePlayback("audio:a");
  claimPlayback("audio:c", () => paused.push("audio:c"));
  assert.deepEqual(paused, ["audio:a", "video:b"], "a stale release never drops the current player");
  releasePlayback("audio:c");
  claimPlayback("audio:d", () => paused.push("audio:d"));
  assert.deepEqual(paused, ["audio:a", "video:b"], "a released player is not paused again");
});

test("message actions: react, pin, forward and reply hit the web app's endpoints", async () => {
  const calls = [];
  const api = createMessagingApi(async (path, options) => { calls.push({ path, options }); return { ok: true, data: {}, message: "" }; }, "workspace");
  await api.react("chat", "m1", "👍");
  await api.react("chat", "m1", null);
  await api.togglePin("chat", "m1");
  await api.forward("chat", "m1", ["a", "b"]);
  await api.send("chat", "Sure", "REPLY", [], "m1");
  assert.deepEqual(calls.map((call) => [call.options.method, call.path]), [
    ["POST", "/w/workspace/inbox/conversations/chat/messages/m1/react"],
    ["POST", "/w/workspace/inbox/conversations/chat/messages/m1/react"],
    ["PATCH", "/w/workspace/inbox/conversations/chat/messages/m1/pin"],
    ["POST", "/w/workspace/inbox/conversations/chat/messages/m1/forward"],
    ["POST", "/w/workspace/inbox/conversations/chat/messages"],
  ]);
  assert.deepEqual(calls[1].options.body, { emoji: null });
  assert.deepEqual(calls[3].options.body, { targetConversationIds: ["a", "b"] });
  assert.equal(calls[4].options.body.get("replyToMessageId"), "m1");
});

test("reactions toggle like WhatsApp, and only sent messages with content can be forwarded", async () => {
  const { nextReactions, myReaction, canForward, canReact, messageSummary } = await import("../src/features/messaging/utils/message-actions.ts");
  const base = { id: "m1", type: "REPLY", direction: "INBOUND", body: "Hi", files: [], fileNames: [], deliveryStatus: "READ", isRevoked: false,
    reactions: [{ emoji: "❤️", reactorUserId: null, reactorContactId: "c1", reactorMobileNumber: null }] };
  const added = nextReactions(base, "me", "👍");
  assert.equal(added.emoji, "👍");
  assert.equal(added.reactions.length, 2, "the customer's reaction stays");
  const withMine = { ...base, reactions: added.reactions };
  assert.equal(myReaction(withMine, "me"), "👍");
  const removed = nextReactions(withMine, "me", "👍");
  assert.equal(removed.emoji, null, "the same emoji again takes it off");
  assert.equal(removed.reactions.length, 1);
  assert.equal(nextReactions(withMine, "me", "😂").reactions.filter((r) => r.reactorUserId === "me")[0].emoji, "😂", "a new emoji replaces yours");
  assert.equal(canForward(base), true);
  assert.equal(canForward({ ...base, type: "PRIVATE_NOTE" }), false);
  assert.equal(canForward({ ...base, isRevoked: true }), false);
  assert.equal(canForward({ ...base, id: "local-1" }), false);
  assert.equal(canReact({ ...base, deliveryStatus: "FAILED" }), false);
  assert.equal(messageSummary({ body: null, files: ["https://x/a.jpg"], fileNames: [] }), "Photo");
});

test("chat pictures: one request per chat, at most 4 at once, kept when the chat has none, only web URLs", async () => {
  const { cachedPicture, clearPictures, loadPicture, subscribePictures } = await import("../src/features/messaging/services/picture-cache.ts");
  clearPictures();
  let inFlight = 0, peak = 0, calls = 0;
  const release = [];
  const loader = (id) => { calls++; inFlight++; peak = Math.max(peak, inFlight); return new Promise((resolve) => release.push(() => { inFlight--;
    resolve({ ok: true, data: { url: id === "none" ? null : id === "bad" ? "javascript:alert(1)" : `https://pics.example/${id}.jpg` } }); })); };
  let changes = 0;
  const stop = subscribePictures(() => changes++);
  for (const id of ["a", "b", "c", "d", "e", "none", "bad"]) loadPicture(id, loader);
  loadPicture("a", loader);
  assert.equal(calls, 4, "four at once, the rest queued, no duplicate for a");
  while (release.length) { release.shift()(); await new Promise((resolve) => setTimeout(resolve, 0)); }
  assert.equal(peak, 4);
  assert.equal(calls, 7);
  assert.equal(cachedPicture("a"), "https://pics.example/a.jpg");
  assert.equal(cachedPicture("none"), null, "no picture is remembered too");
  assert.equal(cachedPicture("bad"), null, "a non-web URL never reaches the image");
  assert.equal(cachedPicture("unknown"), undefined);
  assert.ok(changes >= 7);
  stop(); clearPictures();
});

test("inbox cache: reopened chats and lists come back at once, without optimistic copies, and reads clear badges once", async () => {
  const cache = await import("../src/features/messaging/services/inbox-cache.ts");
  cache.clearInboxCache();
  const conversation = { id: "c1", sessionId: "s1", name: "Ananya" };
  cache.saveThread("c1", { conversation, cursor: null, hasMore: false,
    messages: [{ id: "m1" }, { id: "local-123" }] });
  assert.deepEqual(cache.cachedThread("c1").messages.map((m) => m.id), ["m1"], "a message still sending is never cached");
  cache.saveList("s1:all:", { rows: [conversation], page: 1, more: false });
  assert.equal(cache.cachedList("s1:all:").rows.length, 1);
  cache.markReadLocally("c1");
  assert.deepEqual(cache.takeReadLocally(), ["c1"]);
  assert.deepEqual(cache.takeReadLocally(), [], "taken once");
  for (let i = 0; i < 25; i++) cache.saveThread(`t${i}`, { conversation, cursor: null, hasMore: false, messages: [] });
  assert.equal(cache.cachedThread("c1"), null, "only the most recent chats are kept");
  cache.clearInboxCache();
  assert.equal(cache.cachedList("s1:all:"), null);
});

test("stored chats reconcile like the web app: the newest page wins its window, ticks only move forward", async () => {
  const { applyNewestPage, statusMovesForward } = await import("../src/features/messaging/utils/message-order.ts");
  const at = (minute) => `2026-10-24T10:${String(minute).padStart(2, "0")}:00.000Z`;
  const message = (id, minute) => ({ id, createdAt: at(minute), body: id });
  const stored = [message("old", 1), message("deleted", 5), message("kept", 6), message("socket", 9), message("local-1", 10)];
  const page = [message("kept", 6), message("new", 7), message("edge", 8), message("first", 4)];
  const shown = applyNewestPage(stored, page).map((m) => m.id);
  assert.deepEqual(shown, ["local-1", "socket", "edge", "new", "kept", "first", "old"]);
  assert.ok(!shown.includes("deleted"), "a stored message the page lacks inside its window was deleted");
  assert.deepEqual(applyNewestPage(stored, []), stored, "an empty page changes nothing");
  assert.equal(statusMovesForward("SENT", "READ"), true);
  assert.equal(statusMovesForward("READ", "DELIVERED"), false);
  assert.equal(statusMovesForward("SENT", "FAILED"), true);
  assert.equal(statusMovesForward("DELIVERED", "FAILED"), false, "a delivered message can't fail afterwards");
  assert.equal(statusMovesForward("FAILED", "SENT"), true, "a retry moves on from failed");
});
