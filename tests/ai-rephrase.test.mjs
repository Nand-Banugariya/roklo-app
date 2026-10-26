import assert from "node:assert/strict";
import "./register-typescript.mjs";
import { test } from "node:test";
import { createApiClient } from "../src/services/api/create-client.ts";
import { createMessagingApi } from "../src/features/messaging/services/messaging-api.ts";
import { fillRephraseVariables } from "../src/features/messaging/utils/ai-rephrase.ts";

test("AI rephrase uses the workspace, auth, standard envelope, tone and cancellation signal", async () => {
  const calls = [];
  const controller = new AbortController();
  const request = createApiClient({ baseUrl: "https://example.test", getToken: () => "token",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ success: true, data: { rephrasedContent: "Hello there!" } }), { status: 200 });
    } });
  const api = createMessagingApi(request, "team/west");
  assert.equal((await api.rephrase("hi", controller.signal, "friendly")).data, "Hello there!");
  assert.equal(calls[0].url, "https://example.test/w/team%2Fwest/ai-rephrase");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token");
  assert.deepEqual(JSON.parse(calls[0].options.body), { content: "hi", tone: "friendly" });

  const scopedCalls = [];
  const scoped = createMessagingApi(async (path, options) => {
    scopedCalls.push({ path, options });
    return { ok: true, data: { rephrasedContent: "Hello" }, message: "" };
  }, "workspace");
  await scoped.rephrase("hi", controller.signal);
  assert.equal(scopedCalls[0].options.signal, controller.signal);
  assert.deepEqual(scopedCalls[0].options.body, { content: "hi" }, "Default tone is omitted");
});

test("AI rephrase rejects empty and malformed rewrites and preserves server failures", async () => {
  for (const data of [null, {}, { rephrasedContent: "  " }, { rephrasedContent: 42 }]) {
    const api = createMessagingApi(async () => ({ ok: true, data, message: "" }), "workspace");
    assert.equal((await api.rephrase("hi")).ok, false);
  }
  const failure = { ok: false, reason: "rate_limited", status: 429, message: "Try again later", retryAfter: 60 };
  const api = createMessagingApi(async () => failure, "workspace");
  assert.deepEqual(await api.rephrase("hi"), failure);
  let called = false;
  const unscoped = createMessagingApi(async () => { called = true; }, "");
  assert.equal((await unscoped.rephrase("hi")).ok, false);
  assert.equal(called, false);
});

test("AI-added variables become reviewable chat text, with group names and fallbacks", () => {
  const contact = { name: "Ananya Shah", mobileNumber: "+919999999999", isGroup: false };
  assert.equal(fillRephraseVariables("Hi {{ firstName }}, {{name}}: {{mobile}}. {{offer|your order}} {{unknown}}", contact),
    "Hi Ananya, Ananya Shah: +919999999999. your order [unknown]");
  assert.equal(fillRephraseVariables("Hi {{name}} / {{firstName}}", { ...contact, isGroup: true }), "Hi everyone / everyone");
  assert.equal(fillRephraseVariables("Meet on {{date}} at {{time}}", contact, new Date(2026, 9, 25, 9, 5)), "Meet on 25 October 2026 at 09:05");
  assert.equal(fillRephraseVariables("*Thanks* for reaching out 👋", contact), "*Thanks* for reaching out 👋");
});
