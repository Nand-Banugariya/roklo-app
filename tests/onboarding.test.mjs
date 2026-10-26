import assert from "node:assert/strict";
import { test } from "node:test";
import { configureStore } from "@reduxjs/toolkit";
import "./register-typescript.mjs";

const [
  apiModule,
  validation,
  sliceModule,
  authModule,
  thunks,
  persistenceModule,
  listenerModule,
  clientModule,
  selectors,
  logoModule,
] = await Promise.all([
  import("../src/features/onboarding/services/onboarding-api.ts"),
  import("../src/features/onboarding/utils/validation.ts"),
  import("../src/features/onboarding/store/onboarding-slice.ts"),
  import("../src/features/auth/store/auth-slice.ts"),
  import("../src/features/onboarding/store/onboarding-thunks.ts"),
  import("../src/features/onboarding/services/draft-persistence.ts"),
  import("../src/features/onboarding/store/draft-listener.ts"),
  import("../src/services/api/create-client.ts"),
  import("../src/features/onboarding/store/onboarding-selectors.ts"),
  import("../src/features/onboarding/utils/workspace-logo.ts"),
]);
const { createOnboardingApi } = apiModule;
const { emptyAnswers, prefillAnswers } = validation;
const { onboardingActions: actions } = sliceModule;
const { createSetupDrafts } = persistenceModule;
const user = {
  id: "user-1",
  name: "Ada Lovelace",
  mobileNumber: "919876543210",
  email: null,
  isEmailVerified: false,
  isVerified: true,
  isOnboarded: false,
  workspaceId: "workspace-1",
  hasOwnWorkspace: true,
};
const answers = () => ({
  ...emptyAnswers(),
  workspaceName: "  Acme  ",
  name: "  Ada Lovelace  ",
});
const ok = (data) => ({ ok: true, data, message: "OK" });
const failure = (message, status = 400) => ({
  ok: false,
  reason: "failed",
  message,
  status,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function apiFixture(response = ok(undefined), createForm) {
  const calls = [];
  const api = createOnboardingApi(async (path, options) => {
    calls.push({ path, ...options });
    return response;
  }, createForm);
  return { api, calls };
}

async function fixture(profilePatch = {}) {
  let profile = { ...user, ...profilePatch };
  let token = "token-1";
  let now = 1000000;
  const persisted = new Map();
  const drafts = createSetupDrafts({
    read: async (key) => persisted.get(key) ?? null,
    write: async (key, value) => {
      persisted.set(key, value);
    },
    remove: async (key) => {
      persisted.delete(key);
    },
  });
  const calls = [];
  const services = {
    getToken: () => token,
    now: () => now,
    drafts,
    getMe: async () => ok({ ...profile }),
    api: {
      requestEmailCode: async (email) => {
        calls.push(["request", email]);
        return { ok: true, otpRef: "email-ref" };
      },
      verifyEmailCode: async (ref, otp) => {
        calls.push(["verify", ref, otp]);
        return { ok: true };
      },
      completeOnboarding: async (data, options) => {
        calls.push(["complete", data, options]);
        profile = { ...profile, isOnboarded: true };
        return { ok: true };
      },
    },
  };
  const recorded = [];
  const listener = listenerModule.createDraftListener(drafts);
  const store = configureStore({
    reducer: { auth: authModule.default, onboarding: sliceModule.default },
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: services } })
        .prepend(listener.middleware)
        .concat(() => (next) => (action) => {
          recorded.push(action);
          return next(action);
        }),
  });
  store.dispatch(authModule.setUser({ ...profile }));
  await store.dispatch(thunks.loadOnboarding());
  return {
    store,
    services,
    calls,
    recorded,
    persisted,
    setToken: (value) => {
      token = value;
    },
    advance: (seconds) => {
      now += seconds * 1000;
    },
  };
}

test("fresh onboarding keeps its success screen available until dismissed; existing and other accounts cannot reopen it", async () => {
  const { store } = await fixture();
  assert.equal(selectors.selectShowOnboarding(store.getState()), true);
  store.dispatch(actions.answersChanged(answers()));
  await store.dispatch(thunks.submitOnboarding());
  assert.equal(store.getState().auth.user.isOnboarded, true);
  assert.equal(selectors.selectShowOnboarding(store.getState()), true);
  store.dispatch(actions.completionDismissed());
  assert.equal(selectors.selectShowOnboarding(store.getState()), false);
  const other = {
    ...store.getState(),
    auth: { user: { ...user, id: "other", isOnboarded: true } },
  };
  assert.equal(selectors.selectShowOnboarding(other), false);
  store.dispatch(authModule.signedOut());
  assert.equal(selectors.selectShowOnboarding(store.getState()), false);
  const existing = await fixture({ isOnboarded: true });
  assert.equal(
    selectors.selectShowOnboarding(existing.store.getState()),
    false,
  );
});

test("logo picker normalizes native and web assets and rejects unsupported, unreadable or oversized images", () => {
  const { workspaceLogoFromAsset } = logoModule;
  const asset = {
    name: "company.PNG",
    uri: "file:///cache/company.png",
    size: 1200,
    lastModified: 0,
  };
  assert.deepEqual(workspaceLogoFromAsset(asset, false), {
    kind: "native",
    uri: asset.uri,
    name: asset.name,
    size: 1200,
    type: "image/png",
  });
  const file = new Blob(["image"], { type: "image/jpeg" });
  const web = workspaceLogoFromAsset(
    { ...asset, name: "logo.jpg", file },
    true,
  );
  assert.equal(web.kind, "web");
  assert.equal(web.file, file);
  assert.equal(web.size, file.size);
  assert.equal(web.type, "image/jpeg");
  assert.throws(
    () => workspaceLogoFromAsset({ ...asset, mimeType: "image/gif" }, false),
    /PNG or JPG/,
  );
  assert.throws(
    () => workspaceLogoFromAsset({ ...asset, size: 3 * 1024 * 1024 }, false),
    /under 2 MB/,
  );
  assert.throws(
    () => workspaceLogoFromAsset({ ...asset, size: undefined }, false),
    /couldn't read/,
  );
  assert.throws(() => workspaceLogoFromAsset(asset, true), /couldn't read/);
});

test("skipping the final source step submits the cleared answer and completes an invitee without workspace fields", async () => {
  const { store, calls } = await fixture({ hasOwnWorkspace: false });
  store.dispatch(actions.answersChanged({ source: "GOOGLE_SEARCH" }));
  store.dispatch(actions.nextStep());
  store.dispatch(actions.stepSkipped());
  store.dispatch(actions.stepSkipped());
  assert.equal(store.getState().onboarding.stepId, "source");
  store.dispatch(actions.stepSkipped());
  await store.dispatch(thunks.submitOnboarding());
  const submitted = calls.find(([kind]) => kind === "complete");
  assert.equal(submitted[1].source, "");
  assert.equal(submitted[2].includeWorkspace, false);
  assert.equal(store.getState().onboarding.status, "completed");
});

test("onboarding uses the reference multipart DTO and omits unanswered fields and local use cases", async () => {
  const { api, calls } = apiFixture();
  const data = {
    ...answers(),
    email: "ada+tag@example.test",
    emailVerified: true,
    industry: "SAAS",
    useCases: ["inbox"],
  };
  assert.deepEqual(
    await api.completeOnboarding(data, { includeWorkspace: true }),
    { ok: true },
  );
  assert.equal(calls[0].path, "/auth/onboarding");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body.get("workspaceName"), "Acme");
  assert.deepEqual(JSON.parse(calls[0].body.get("onboardingDto")), {
    name: "Ada Lovelace",
    email: "ada@example.test",
    occupation: "SAAS",
  });
});

test("multipart reaches fetch unchanged with bearer auth and no JSON Content-Type", async () => {
  let sent;
  const client = clientModule.createApiClient({
    baseUrl: "https://api.test",
    getToken: () => "bearer",
    fetch: async (_url, init) => {
      sent = init;
      return Response.json({ success: true, data: {}, message: "OK" });
    },
  });
  const api = createOnboardingApi(client);
  const file = new Blob(["logo"], { type: "image/png" });
  await api.completeOnboarding(answers(), {
    includeWorkspace: true,
    logo: {
      kind: "web",
      file,
      name: "logo.png",
      type: "image/png",
      size: file.size,
    },
  });
  assert.ok(sent.body instanceof FormData);
  assert.equal(sent.body.get("workspaceLogo").name, "logo.png");
  assert.equal(sent.headers.Authorization, "Bearer bearer");
  assert.equal(sent.headers["Content-Type"], undefined);
});

test("native logo URI parts retain their file name/type, and invalid images do not make requests", async () => {
  const parts = [];
  const { api, calls } = apiFixture(ok(undefined), () => ({
    append: (...part) => parts.push(part),
  }));
  const logo = {
    kind: "native",
    uri: "file:///cache/logo.png",
    name: "logo.png",
    type: "image/png",
    size: 1000,
  };
  await api.completeOnboarding(answers(), { includeWorkspace: true, logo });
  assert.deepEqual(parts.find((part) => part[0] === "workspaceLogo")[1], {
    uri: logo.uri,
    name: "logo.png",
    type: "image/png",
  });
  assert.equal(
    (
      await api.completeOnboarding(answers(), {
        includeWorkspace: true,
        logo: { ...logo, type: "image/svg+xml" },
      })
    ).reason,
    "invalid_logo",
  );
  assert.equal(
    (
      await api.completeOnboarding(answers(), {
        includeWorkspace: true,
        logo: { ...logo, size: 3 * 1024 * 1024 },
      })
    ).reason,
    "invalid_logo",
  );
  assert.equal(calls.length, 1);
});

test("invite setup omits workspace fields, and unverified email never enters the DTO", async () => {
  const { api, calls } = apiFixture();
  await api.completeOnboarding(
    { ...answers(), email: "unverified@example.test" },
    { includeWorkspace: true, inviteToken: "invite" },
  );
  assert.equal(calls[0].body.get("inviteToken"), "invite");
  assert.equal(calls[0].body.has("workspaceName"), false);
  assert.equal(calls[0].body.has("workspaceLogo"), false);
  assert.deepEqual(JSON.parse(calls[0].body.get("onboardingDto")), {
    name: "Ada Lovelace",
  });
});

test("profile email APIs use the exact endpoints and normalize aliases", async () => {
  const request = apiFixture(ok({ otpRef: "ref-1" }));
  assert.deepEqual(
    await request.api.requestEmailCode(" ada+work@example.test "),
    { ok: true, otpRef: "ref-1" },
  );
  assert.equal(
    request.calls[0].path,
    "/settings/profile/email-verification/request",
  );
  assert.deepEqual(request.calls[0].body, { email: "ada@example.test" });
  const verify = apiFixture();
  await verify.api.verifyEmailCode("ref-1", "654321");
  assert.equal(
    verify.calls[0].path,
    "/settings/profile/email-verification/verify",
  );
  assert.deepEqual(verify.calls[0].body, { otpRef: "ref-1", otp: "654321" });
});

test("setup maps already-onboarded, email conflicts, malformed OTP responses and invalid codes", async () => {
  assert.equal(
    (
      await apiFixture(
        failure("User already onboarded"),
      ).api.completeOnboarding(answers(), { includeWorkspace: true })
    ).reason,
    "already_onboarded",
  );
  assert.equal(
    (
      await apiFixture(
        failure("A user with this email already exists."),
      ).api.completeOnboarding(answers(), { includeWorkspace: true })
    ).reason,
    "email_taken",
  );
  assert.deepEqual(
    await apiFixture(
      failure("This email is already verified"),
    ).api.requestEmailCode("a@example.test"),
    { ok: true, alreadyVerified: true },
  );
  assert.equal(
    (
      await apiFixture(failure("Email already exists")).api.requestEmailCode(
        "a@example.test",
      )
    ).reason,
    "email_taken",
  );
  assert.equal(
    (await apiFixture(ok({})).api.requestEmailCode("a@example.test")).reason,
    "failed",
  );
  assert.equal(
    (
      await apiFixture(
        failure("Invalid or expired verification code"),
      ).api.verifyEmailCode("ref", "654321")
    ).reason,
    "invalid_code",
  );
});

test("new owners start with workspace, invitees start with About you, and optional steps can be skipped", async () => {
  const owner = await fixture();
  assert.equal(owner.store.getState().onboarding.stepId, "workspace");
  owner.store.dispatch(actions.nextStep());
  assert.equal(owner.store.getState().onboarding.stepId, "workspace");
  owner.store.dispatch(actions.answersChanged({ workspaceName: "Acme" }));
  owner.store.dispatch(actions.nextStep());
  assert.equal(owner.store.getState().onboarding.stepId, "you");
  owner.store.dispatch(actions.answersChanged({ email: "a@example.test" }));
  owner.store.dispatch(actions.nextStep());
  assert.equal(
    owner.store.getState().onboarding.stepId,
    "you",
    "unverified optional email blocks continue",
  );
  owner.store.dispatch(actions.answersChanged({ email: "" }));
  owner.store.dispatch(actions.nextStep());
  owner.store.dispatch(
    actions.answersChanged({ industry: "SAAS", teamSize: "JUST_ME" }),
  );
  owner.store.dispatch(actions.stepSkipped());
  assert.equal(owner.store.getState().onboarding.stepId, "usage");
  assert.equal(owner.store.getState().onboarding.answers.industry, "");
  assert.equal(owner.store.getState().onboarding.answers.teamSize, "");
  const invitee = await fixture({ hasOwnWorkspace: false });
  assert.equal(invitee.store.getState().onboarding.stepId, "you");
  assert.equal(invitee.store.getState().onboarding.includeWorkspace, false);
});

test("saved emailVerified is reconciled with the server, not trusted from draft storage", () => {
  const saved = {
    version: 1,
    userId: user.id,
    stepId: "you",
    answers: { ...answers(), email: "other@example.test", emailVerified: true },
  };
  assert.equal(
    prefillAnswers(
      { ...user, email: "ada@example.test", isEmailVerified: true },
      saved,
    ).emailVerified,
    false,
  );
  saved.answers.email = "ada+tag@example.test";
  assert.equal(
    prefillAnswers(
      { ...user, email: "ada@example.test", isEmailVerified: true },
      saved,
    ).emailVerified,
    true,
  );
  saved.userId = "different-account";
  assert.equal(prefillAnswers(user, saved).workspaceName, "");
});

test("editing email ignores a late OTP response and cannot mark a different email verified", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ email: "first@example.test" }));
  const pending = deferred();
  f.services.api.requestEmailCode = () => pending.promise;
  const task = f.store.dispatch(thunks.sendOnboardingEmailCode());
  f.store.dispatch(actions.answersChanged({ email: "second@example.test" }));
  pending.resolve({ ok: true, otpRef: "old-ref" });
  await task;
  assert.equal(f.store.getState().onboarding.email.otpRef, null);
  assert.equal(f.store.getState().onboarding.answers.emailVerified, false);
});

test("email verify keeps OTP out of Redux actions and persisted drafts; cooldown prevents duplicate requests", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ email: "ada+work@example.test" }));
  await f.store.dispatch(thunks.sendOnboardingEmailCode());
  await f.store.dispatch(thunks.sendOnboardingEmailCode());
  assert.equal(f.calls.filter((call) => call[0] === "request").length, 1);
  await f.store.dispatch(thunks.verifyOnboardingEmailCode("472819"));
  assert.equal(f.store.getState().onboarding.answers.emailVerified, true);
  assert.equal(f.store.getState().auth.user.email, "ada@example.test");
  assert.equal(JSON.stringify(f.recorded).includes("472819"), false);
  assert.equal(
    JSON.stringify(await f.services.drafts.read(user.id)).includes("472819"),
    false,
  );
});

test("email rate-limit deadlines use server retry seconds, and resend replaces the reference", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ email: "ada@example.test" }));
  f.services.api.requestEmailCode = async () => ({
    ok: false,
    reason: "rate_limited",
    retryAfter: 42,
  });
  await f.store.dispatch(thunks.sendOnboardingEmailCode());
  assert.equal(f.store.getState().onboarding.email.retryAvailableAt, 1042000);
  f.advance(43);
  f.services.api.requestEmailCode = async () => ({
    ok: true,
    otpRef: "new-ref",
  });
  await f.store.dispatch(thunks.sendOnboardingEmailCode());
  assert.equal(f.store.getState().onboarding.email.otpRef, "new-ref");
});

test("submitting twice makes one request; success marks auth onboarded and clears its draft", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ workspaceName: "Acme" }));
  const pending = deferred();
  let count = 0;
  f.services.api.completeOnboarding = () => {
    count++;
    return pending.promise;
  };
  const first = f.store.dispatch(thunks.submitOnboarding());
  await f.store.dispatch(thunks.submitOnboarding());
  assert.equal(count, 1);
  pending.resolve({ ok: true });
  await first;
  assert.equal(f.store.getState().onboarding.status, "completed");
  assert.equal(f.store.getState().auth.user.isOnboarded, true);
  assert.equal(await f.services.drafts.read(user.id), null);
});

test("successful submission stays complete when profile refresh fails and cannot be retried", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ workspaceName: "Acme" }));
  f.services.getMe = async () => ({
    ok: false,
    reason: "network",
    status: 0,
    message: "Offline",
  });
  await f.store.dispatch(thunks.submitOnboarding());
  await f.store.dispatch(thunks.submitOnboarding());
  assert.equal(f.store.getState().onboarding.profileRefreshFailed, true);
  assert.equal(f.store.getState().auth.user.isOnboarded, true);
  assert.equal(f.calls.filter((call) => call[0] === "complete").length, 1);
  f.store.dispatch(authModule.setUser({ ...user, isOnboarded: false }));
  assert.equal(
    f.store.getState().auth.user.isOnboarded,
    true,
    "late startup GET /auth/me cannot undo completed onboarding",
  );
});

test("email-taken submission returns to About you with the answers retained", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ workspaceName: "Acme" }));
  f.services.api.completeOnboarding = async () => ({
    ok: false,
    reason: "email_taken",
  });
  await f.store.dispatch(thunks.submitOnboarding());
  assert.equal(f.store.getState().onboarding.stepId, "you");
  assert.equal(f.store.getState().onboarding.status, "ready");
  assert.equal(f.store.getState().onboarding.answers.workspaceName, "Acme");
});

test("logout or switching accounts ignores late completion and resets private setup state", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ workspaceName: "Private" }));
  const pending = deferred();
  f.services.api.completeOnboarding = () => pending.promise;
  const request = f.store.dispatch(thunks.submitOnboarding());
  f.setToken("token-2");
  f.store.dispatch(authModule.signedOut());
  f.store.dispatch(authModule.setUser({ ...user, id: "user-2" }));
  pending.resolve({ ok: true });
  await request;
  assert.equal(f.store.getState().onboarding.ownerId, null);
  assert.equal(f.store.getState().onboarding.answers.workspaceName, "");
  assert.equal(f.store.getState().auth.user.id, "user-2");
  assert.equal(f.store.getState().auth.user.isOnboarded, false);
  assert.equal(await f.services.drafts.read(user.id), null);
});

test("draft persistence serializes a slow write before logout deletion", async () => {
  const pending = deferred();
  let stored = null;
  const drafts = createSetupDrafts({
    read: async () => stored,
    write: async (_key, data) => {
      await pending.promise;
      stored = data;
    },
    remove: async () => {
      stored = null;
    },
  });
  const save = drafts.save({
    version: 1,
    userId: user.id,
    answers: answers(),
    stepId: "you",
  });
  const clear = drafts.clear(user.id);
  pending.resolve();
  await Promise.all([save, clear]);
  assert.equal(await drafts.read(user.id), null);
});

test("already-onboarded response completes setup without creating another workspace", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ workspaceName: "Acme" }));
  let posts = 0;
  f.services.api.completeOnboarding = async () => {
    posts++;
    return { ok: false, reason: "already_onboarded" };
  };
  await f.store.dispatch(thunks.submitOnboarding());
  await f.store.dispatch(thunks.submitOnboarding());
  assert.equal(posts, 1);
  assert.equal(f.store.getState().onboarding.completion, "already_onboarded");
  assert.equal(f.store.getState().auth.user.isOnboarded, true);
});

test("failed setup retains the draft and can be retried explicitly", async () => {
  const f = await fixture();
  f.store.dispatch(actions.answersChanged({ workspaceName: "Acme" }));
  f.services.api.completeOnboarding = async () => ({
    ok: false,
    reason: "network",
  });
  await f.store.dispatch(thunks.submitOnboarding());
  assert.equal(f.store.getState().onboarding.status, "ready");
  assert.equal(
    (await f.services.drafts.read(user.id)).answers.workspaceName,
    "Acme",
  );
  f.services.api.completeOnboarding = async () => ({ ok: true });
  await f.store.dispatch(thunks.submitOnboarding());
  assert.equal(f.store.getState().onboarding.status, "completed");
});
