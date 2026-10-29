import assert from "node:assert/strict";
import "./register-typescript.mjs";
import { test } from "node:test";
import { createApiClient } from "../src/services/api/create-client.ts";
import { createNotificationApi } from "../src/features/notifications/services/notification-api.ts";
import { createPushRegistration } from "../src/features/notifications/services/create-push-registration.ts";
import { createNotificationActions } from "../src/features/notifications/services/notification-actions.ts";
import { notificationTarget } from "../src/features/notifications/utils/notification-target.ts";

const target = {
  workspaceId: "workspace-1",
  conversationId: "conversation-1",
  messageId: "note-1",
};
const success = { ok: true, data: null, message: "" };
const failure = { ok: false, status: 503, reason: "failed", message: "Try again later" };

test("notification targets accept mentions and incoming messages, rejecting other events and unsafe identifiers", () => {
  assert.deepEqual(notificationTarget(target), target);
  assert.deepEqual(notificationTarget({ event: "inbox.mention", ...target }), target);
  assert.deepEqual(notificationTarget({ payload: target }), target);
  assert.deepEqual(
    notificationTarget({
      event: "inbox.message.received",
      ...target,
      sessionId: "untrusted-number",
    }),
    target,
  );
  assert.deepEqual(
    notificationTarget({ payload: { ...target, event: "inbox.message.received" } }),
    target,
  );
  assert.deepEqual(
    notificationTarget({
      event: "inbox.message.received",
      payload: { ...target, event: "inbox.message.received" },
    }),
    target,
  );
  for (const data of [
    null,
    [],
    "{}",
    {},
    { ...target, messageId: null },
    { ...target, event: "inbox.message.new" },
    { event: "inbox.message.new", payload: target },
    { payload: { ...target, event: "inbox.chat_waiting" } },
    { ...target, workspaceId: ["workspace-1"] },
    { ...target, messageId: "../settings" },
    { ...target, conversationId: "https://example.test" },
    { ...target, workspaceId: "workspace\n1" },
    { ...target, messageId: "x".repeat(201) },
    { url: "/chat/conversation-1" },
    { event: "inbox.message.received", payload: { ...target, event: "inbox.mention" } },
    { event: "inbox.mention", payload: { ...target, event: "inbox.message.received" } },
  ]) {
    assert.equal(notificationTarget(data), null, JSON.stringify(data));
  }
});

test("notification endpoints use account auth, Expo credentials, and an authenticated unfiltered conversation lookup", async () => {
  const calls = [];
  const api = createNotificationApi(
    createApiClient({
      baseUrl: "https://example.test",
      getToken: () => "active-token",
      fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(
          JSON.stringify(
            options.method === "GET"
              ? { data: [{ id: "chat", sessionId: "number" }] }
              : { success: true, data: null },
          ),
          { status: 200 },
        );
      },
    }),
  );
  await api.register("ExponentPushToken[test]");
  await api.unregister({ token: "logout-token" });
  const result = await api.conversation("team/west", "chat&other=value");
  assert.equal(calls[0].url, "https://example.test/notifications/push-devices");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    providerId: "expo",
    deviceToken: "ExponentPushToken[test]",
  });
  assert.equal(calls[0].options.headers.Authorization, "Bearer active-token");
  assert.equal(calls[1].url, "https://example.test/notifications/push-devices/expo");
  assert.equal(calls[1].options.method, "DELETE");
  assert.equal(calls[1].options.headers.Authorization, "Bearer logout-token");
  assert.equal(
    calls[2].url,
    "https://example.test/w/team%2Fwest/inbox/conversations?conversationId=chat%26other%3Dvalue",
  );
  assert.deepEqual(result.data.data, [{ id: "chat", sessionId: "number" }]);
});

test("incoming preference API reads and patches the authenticated account with an unwrapped boolean response", async () => {
  const calls = [];
  const api = createNotificationApi(
    createApiClient({
      baseUrl: "https://example.test",
      getToken: () => "active-token",
      fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(
          JSON.stringify({
            success: true,
            statusCode: 200,
            data: { enabled: options.method === "PATCH" ? JSON.parse(options.body).enabled : true },
          }),
          { status: 200 },
        );
      },
    }),
  );
  assert.deepEqual((await api.incomingMessages()).data, { enabled: true });
  assert.deepEqual((await api.setIncomingMessages(false, { token: "explicit-auth" })).data, {
    enabled: false,
  });
  assert.deepEqual(
    calls.map((call) => call.url),
    Array(2).fill("https://example.test/notifications/incoming-messages"),
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Authorization, "Bearer active-token");
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.headers.Authorization, "Bearer explicit-auth");
  assert.deepEqual(JSON.parse(calls[1].options.body), { enabled: false });
});

function fixture(initial = []) {
  const values = new Map(initial);
  const calls = [];
  const state = {
    auth: "auth",
    granted: true,
    canAskAgain: true,
    deviceToken: "ExponentPushToken[first]",
    registerResult: success,
    unregisterResult: success,
    incomingEnabled: false,
    incomingResult: null,
  };
  const native = {
    permission: async (ask) => {
      calls.push(["permission", ask]);
      return { granted: state.granted, canAskAgain: state.canAskAgain };
    },
    token: async () => {
      calls.push(["token"]);
      return state.deviceToken;
    },
    stop: async () => {
      calls.push(["stop"]);
    },
    foreground: (enabled) => {
      calls.push(["foreground", enabled]);
    },
  };
  const api = {
    register: async (token, options) => {
      calls.push(["register", token, options.token]);
      return state.registerResult;
    },
    unregister: async (options) => {
      calls.push(["unregister", options.token]);
      return state.unregisterResult;
    },
    incomingMessages: async (options) => {
      calls.push(["incoming-get", options.token]);
      return state.incomingResult ?? { ...success, data: { enabled: state.incomingEnabled } };
    },
    setIncomingMessages: async (enabled, options) => {
      calls.push(["incoming-patch", enabled, options.token]);
      if (state.incomingResult) return state.incomingResult;
      state.incomingEnabled = enabled;
      return { ...success, data: { enabled } };
    },
  };
  const manager = createPushRegistration({
    api,
    runtime: async () => native,
    getToken: () => state.auth,
    storage: {
      read: async (key) => values.get(key) ?? null,
      write: async (key, value) => values.set(key, value),
      remove: async (key) => values.delete(key),
    },
  });
  return { manager, values, calls, state, native, api };
}

test("startup does not prompt or register until the account opts in", async () => {
  const f = fixture();
  assert.equal((await f.manager.sync("user", "auth")).enabled, false);
  assert.deepEqual(f.calls, []);
  assert.equal((await f.manager.sync("user", "auth", true)).enabled, true);
  assert.deepEqual(
    f.calls.find((call) => call[0] === "permission"),
    ["permission", true],
  );
  assert.equal(f.values.get("roklo.push.user"), "on");
  assert.equal(f.values.get("roklo.push.owner"), "user");
});

test("restored opt-in registers silently, deduplicates resume, and registers rotated tokens", async () => {
  const f = fixture([["roklo.push.user", "on"]]);
  await f.manager.sync("user", "auth");
  await f.manager.sync("user", "auth");
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 1);
  assert.equal(
    f.calls.some((call) => call[0] === "permission" && call[1] === true),
    false,
  );
  f.state.deviceToken = "ExponentPushToken[rotated]";
  await f.manager.sync("user", "auth");
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 2);
});

test("denied permission does not fetch a token; granting it in system settings resumes registration", async () => {
  const f = fixture();
  f.state.granted = false;
  f.state.canAskAgain = false;
  const denied = await f.manager.sync("user", "auth", true);
  assert.equal(denied.enabled, false);
  assert.equal(denied.blocked, true);
  assert.equal(
    f.calls.some((call) => call[0] === "token" || call[0] === "register"),
    false,
  );
  f.state.granted = true;
  assert.equal((await f.manager.sync("user", "auth")).enabled, true);
});

test("failed registration can retry and never loses ownership after an ambiguous HTTP result", async () => {
  const f = fixture();
  f.state.registerResult = failure;
  await assert.rejects(f.manager.sync("user", "auth", true), /Try again later/);
  assert.equal(f.values.get("roklo.push.owner"), "user");
  f.state.registerResult = success;
  assert.equal((await f.manager.sync("user", "auth")).enabled, true);
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 2);
});

test("a session invalidated while fetching the native token cannot register against a new account", async () => {
  const f = fixture();
  f.native.token = async () => {
    f.state.auth = "other-account-token";
    return "ExponentPushToken[late]";
  };
  assert.equal((await f.manager.sync("user", "auth", true)).enabled, false);
  assert.equal(
    f.calls.some((call) => call[0] === "register"),
    false,
  );
});

test("sign-out waits for in-flight registration then removes credentials before stopping native push", async () => {
  const f = fixture();
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  let started;
  const registrationStarted = new Promise((resolve) => {
    started = resolve;
  });
  f.api.register = async () => {
    f.calls.push(["register"]);
    started();
    await waiting;
    return success;
  };
  const registering = f.manager.sync("user", "auth", true);
  await registrationStarted;
  const signingOut = f.manager.signOut("user", "auth");
  release();
  await Promise.all([registering, signingOut]);
  assert.deepEqual(
    f.calls
      .filter((call) => ["register", "unregister", "stop"].includes(call[0]))
      .map((call) => call[0]),
    ["register", "unregister", "stop"],
  );
  assert.equal(f.values.has("roklo.push.owner"), false);
});

test("failed disable retains the enabled preference and ownership so the user can retry", async () => {
  const f = fixture();
  await f.manager.sync("user", "auth", true);
  f.state.unregisterResult = failure;
  await assert.rejects(f.manager.disable("user", "auth"), /Try again later/);
  assert.equal(f.values.get("roklo.push.user"), "on");
  assert.equal(f.values.get("roklo.push.owner"), "user");
  f.state.unregisterResult = success;
  assert.equal((await f.manager.disable("user", "auth")).enabled, false);
  assert.equal(f.values.get("roklo.push.user"), "off");
  assert.equal(f.values.has("roklo.push.owner"), false);
});

test("failed sign-out cleanup stops native push and prevents another account from reusing the installation", async () => {
  const f = fixture([["roklo.push.owner", "old-user"]]);
  f.state.unregisterResult = failure;
  await f.manager.signOut("old-user", "auth");
  assert.equal(
    f.calls.some((call) => call[0] === "stop"),
    true,
  );
  assert.equal(f.values.get("roklo.push.owner"), "old-user");
  f.state.auth = "new-auth";
  await assert.rejects(f.manager.sync("new-user", "new-auth", true), /another account/);
  assert.equal(
    f.calls.some((call) => call[0] === "register"),
    false,
  );
});

test("session expiration stops native push without using an expired token to remove credentials", async () => {
  const f = fixture([["roklo.push.owner", "user"]]);
  f.state.auth = null;
  await f.manager.stopLocally();
  assert.deepEqual(f.calls, [["stop"]]);
  assert.equal(f.values.get("roklo.push.owner"), "user");
});

test("incoming preference refresh reads the server without prompting or registering this phone", async () => {
  const f = fixture();
  assert.deepEqual(await f.manager.incomingPreference("auth"), { enabled: false });
  f.state.incomingEnabled = true;
  assert.deepEqual(await f.manager.incomingPreference("auth"), { enabled: true });
  assert.deepEqual(f.calls, [
    ["incoming-get", "auth"],
    ["incoming-get", "auth"],
  ]);
});

test("incoming opt-in requires this account's successful device registration", async () => {
  const f = fixture();
  await assert.rejects(
    f.manager.setIncomingEnabled("user", "auth", true),
    /Turn on phone notifications/,
  );
  f.state.granted = false;
  await f.manager.sync("user", "auth", true);
  await assert.rejects(
    f.manager.setIncomingEnabled("user", "auth", true),
    /Turn on phone notifications/,
  );
  assert.equal(
    f.calls.some((call) => call[0] === "incoming-patch"),
    false,
  );
  f.state.granted = true;
  await f.manager.sync("user", "auth", true);
  assert.deepEqual(await f.manager.setIncomingEnabled("user", "auth", true), { enabled: true });
  assert.ok(
    f.calls.findIndex((call) => call[0] === "register") <
      f.calls.findIndex((call) => call[0] === "incoming-patch"),
  );
  await assert.rejects(
    f.manager.setIncomingEnabled("another-user", "auth", true),
    /Turn on phone notifications/,
  );
});

test("turning off incoming messages preserves shared registration and mentions", async () => {
  const f = fixture();
  await f.manager.sync("user", "auth", true);
  await f.manager.setIncomingEnabled("user", "auth", true);
  assert.deepEqual(await f.manager.setIncomingEnabled("user", "auth", false), { enabled: false });
  assert.equal(f.values.get("roklo.push.user"), "on");
  assert.equal(f.values.get("roklo.push.owner"), "user");
  assert.equal(
    f.calls.some((call) => call[0] === "unregister" || call[0] === "stop"),
    false,
  );
  assert.equal((await f.manager.sync("user", "auth")).enabled, true);
});

test("incoming notifications can be disabled even with phone permission denied", async () => {
  const f = fixture();
  f.state.granted = false;
  f.state.incomingEnabled = true;
  assert.deepEqual(await f.manager.setIncomingEnabled("user", "auth", false), { enabled: false });
  assert.deepEqual(f.calls, [["incoming-patch", false, "auth"]]);
});

test("a failed incoming update preserves device registration and retries the requested value", async () => {
  const f = fixture();
  await f.manager.sync("user", "auth", true);
  await f.manager.setIncomingEnabled("user", "auth", true);
  f.state.incomingResult = failure;
  await assert.rejects(f.manager.setIncomingEnabled("user", "auth", false), /Try again later/);
  assert.equal(f.state.incomingEnabled, true);
  assert.equal(f.values.get("roklo.push.user"), "on");
  f.state.incomingResult = null;
  assert.deepEqual(await f.manager.setIncomingEnabled("user", "auth", false), { enabled: false });
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 1);
});

test("an unavailable or malformed incoming API is reported without disabling mention registration", async () => {
  const f = fixture();
  await f.manager.sync("user", "auth", true);
  for (const response of [
    failure,
    { ...success, data: null },
    { ...success, data: { enabled: "true" } },
  ]) {
    f.state.incomingResult = response;
    await assert.rejects(f.manager.incomingPreference("auth"));
    await assert.rejects(f.manager.setIncomingEnabled("user", "auth", true));
    assert.equal((await f.manager.sync("user", "auth")).enabled, true);
  }
  f.state.incomingResult = { ...success, data: { enabled: false } };
  await assert.rejects(f.manager.setIncomingEnabled("user", "auth", true), /confirm/);
});

test("account changes discard late incoming preference responses", async () => {
  const f = fixture();
  f.api.incomingMessages = async () => {
    f.state.auth = "new-account";
    return { ...success, data: { enabled: true } };
  };
  assert.equal(await f.manager.incomingPreference("auth"), null);
  assert.equal(await f.manager.setIncomingEnabled("user", "auth", false), null);
  assert.equal(
    f.calls.some((call) => call[0] === "incoming-patch"),
    false,
  );
});

test("logout blocks queued and subsequent settings actions before credentials are removed", async () => {
  const f = fixture();
  await f.manager.sync("user", "auth", true);
  const signingOut = f.manager.signOut("user", "auth");
  const lateSync = f.manager.sync("user", "auth", true);
  const lateEnable = f.manager.setIncomingEnabled("user", "auth", true);
  const lateRead = f.manager.incomingPreference("auth");
  await signingOut;
  assert.equal((await lateSync).enabled, false);
  assert.equal(await lateEnable, null);
  assert.equal(await lateRead, null);
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 1);
  assert.equal(
    f.calls.some((call) => call[0].startsWith("incoming-")),
    false,
  );
  assert.equal(f.state.incomingEnabled, false);
});

test("phone disable and sign-out preserve the account's incoming preference", async () => {
  const f = fixture();
  await f.manager.sync("user", "auth", true);
  await f.manager.setIncomingEnabled("user", "auth", true);
  await f.manager.disable("user", "auth");
  assert.equal(f.state.incomingEnabled, true);
  await f.manager.sync("user", "auth", true);
  await f.manager.signOut("user", "auth");
  assert.equal(f.state.incomingEnabled, true);
});

function actionFixture({ token = "auth", send = success, markRead = success } = {}) {
  const calls = [];
  const handle = createNotificationActions({
    token: async () => token,
    api: (workspaceId, auth) => ({
      send: async (conversationId, text) => {
        calls.push(["send", workspaceId, auth, conversationId, text]);
        return send;
      },
      markRead: async (conversationId) => {
        calls.push(["read", workspaceId, auth, conversationId]);
        return markRead;
      },
    }),
    dismiss: async (id) => {
      calls.push(["dismiss", id]);
    },
    notifyFailure: async (failed, content) => {
      calls.push(["failure", failed, content.title]);
    },
  });
  return { calls, handle };
}
const press = (actionIdentifier, extra = {}) => ({
  notificationId: "push-1",
  actionIdentifier,
  data: { event: "inbox.message.received", ...target },
  ...extra,
});

test("notification Reply sends the trimmed text, reads the chat and removes the notification once", async () => {
  const f = actionFixture();
  assert.equal(await f.handle(press("reply", { userText: "  On my way  " })), true);
  assert.equal(await f.handle(press("reply", { userText: "On my way" })), true);
  assert.deepEqual(f.calls, [
    ["send", "workspace-1", "auth", "conversation-1", "On my way"],
    ["read", "workspace-1", "auth", "conversation-1"],
    ["dismiss", "push-1"],
  ]);
});

test("notification Mark as read reads the chat; plain taps and empty replies are left alone", async () => {
  const f = actionFixture();
  assert.equal(await f.handle(press("expo.modules.notifications.actions.DEFAULT")), false);
  assert.equal(await f.handle(press("reply", { userText: "   " })), true);
  assert.equal(await f.handle(press("mark_read")), true);
  assert.deepEqual(f.calls, [
    ["read", "workspace-1", "auth", "conversation-1"],
    ["dismiss", "push-1"],
  ]);
});

test("notification action failures replace the notification with one that opens the chat", async () => {
  const rejected = actionFixture({ send: failure });
  await rejected.handle(press("reply", { userText: "hello" }));
  assert.deepEqual(rejected.calls.slice(1), [
    ["dismiss", "push-1"],
    ["failure", target, "Reply not sent"],
  ]);

  const lost = actionFixture({ send: { ...failure, reason: "network", status: 0 } });
  await lost.handle(press("reply", { userText: "hello" }));
  assert.deepEqual(lost.calls.at(-1), ["failure", target, "Reply may not have been sent"]);

  const signedOut = actionFixture({ token: null });
  await signedOut.handle(press("mark_read"));
  assert.deepEqual(signedOut.calls, [
    ["dismiss", "push-1"],
    ["failure", target, "Couldn't mark the chat as read"],
  ]);

  const unsafe = actionFixture();
  await unsafe.handle({
    ...press("mark_read"),
    data: { ...target, conversationId: "../settings" },
  });
  assert.deepEqual(unsafe.calls, [["dismiss", "push-1"]]);
});
