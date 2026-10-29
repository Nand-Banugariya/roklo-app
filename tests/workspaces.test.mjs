import assert from "node:assert/strict";
import { test } from "node:test";
import { configureStore } from "@reduxjs/toolkit";
import "./register-typescript.mjs";

const [apiModule, workspaceModule, thunkModule, authModule, selectors, navigation] =
  await Promise.all([
    import("../src/features/workspaces/services/workspace-api.ts"),
    import("../src/features/workspaces/store/workspace-slice.ts"),
    import("../src/features/workspaces/store/create-workspace-thunks.ts"),
    import("../src/features/auth/store/auth-slice.ts"),
    import("../src/features/workspaces/store/workspace-selectors.ts"),
    import("../src/features/navigation/config/navigation.ts"),
  ]);
const user = {
  id: "user-1",
  name: "Priya Sharma",
  email: "priya@example.test",
  mobileNumber: "919876543210",
  isVerified: true,
  isEmailVerified: true,
  isOnboarded: true,
  workspaceId: "one",
  defaultWorkspaceId: "two",
};
const items = [
  { id: "one", name: "Sharma Insurance", logo: null, role: "OWNER", status: "ENABLED" },
  { id: "two", name: "Studio", logo: null, role: "MEMBER", status: "ENABLED" },
  { id: "disabled", name: "Disabled", logo: null, status: "DISABLED" },
];
const ok = (data) => ({ ok: true, data, message: "OK" });
const fail = () => ({ ok: false, reason: "network", status: 0, message: "" });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fixture(profile = user) {
  let token = "session-one";
  const calls = [];
  const api = {
    list: async (options) => {
      calls.push(["list", options.token]);
      return ok([...items]);
    },
    detail: async (id, options) => {
      calls.push(["detail", id, options.token]);
      return ok(items.find((item) => item.id === id));
    },
    setDefault: async (id, options) => {
      calls.push(["default", id, options.token]);
      return ok(null);
    },
  };
  const thunks = thunkModule.createWorkspaceThunks({ api, getToken: () => token });
  const store = configureStore({
    reducer: { auth: authModule.default, workspace: workspaceModule.default },
  });
  store.dispatch(authModule.setUser(profile));
  return {
    api,
    thunks,
    store,
    calls,
    token: (value) => {
      token = value;
    },
  };
}

test("workspace API follows v2 endpoints, encodes IDs, and rejects malformed or deleted records", async () => {
  const calls = [];
  let data = [...items, { ...items[0], id: "deleted", isDeleted: true }];
  const api = apiModule.createWorkspaceApi(async (path, options) => {
    calls.push([path, options]);
    return ok(data);
  });
  assert.deepEqual((await api.list({ token: "token" })).data, items);
  data = { ...items[0], id: "space/id" };
  assert.equal((await api.detail("space/id")).ok, true);
  await api.setDefault("space/id", { token: "token" });
  assert.equal(calls[1][0], "/workspaces/space%2Fid");
  assert.equal(calls[2][0], "/workspaces/space%2Fid/set-default");
  assert.equal(calls[2][1].method, "PUT");
  assert.equal(calls[2][1].token, "token");
  data = [{ id: 4, name: "Invalid" }];
  assert.equal((await api.list()).ok, false);
  data = { ...items[0], id: "wrong" };
  assert.equal((await api.detail("one")).ok, false);
});

test("workspace load respects membership/default selection and is idempotent across page navigation", async () => {
  const { store, thunks, calls } = fixture();
  await store.dispatch(thunks.loadWorkspaces());
  await store.dispatch(thunks.loadWorkspaces());
  assert.equal(selectors.selectActiveWorkspace(store.getState()).id, "two");
  assert.equal(calls.filter(([kind]) => kind === "list").length, 1);
  assert.equal(store.getState().workspace.status, "ready");
  const fallback = fixture({ ...user, defaultWorkspaceId: "not-a-membership", workspaceId: null });
  await fallback.store.dispatch(fallback.thunks.loadWorkspaces());
  assert.equal(fallback.store.getState().workspace.activeId, "one");
});

test("switch waits for default-workspace success, preserves auth profile, and gates duplicate/disabled requests", async () => {
  const { store, thunks, api, calls } = fixture();
  await store.dispatch(thunks.loadWorkspaces());
  const response = deferred();
  api.setDefault = async (id) => {
    calls.push(["default", id]);
    return response.promise;
  };
  const switching = store.dispatch(thunks.switchWorkspace("one"));
  assert.equal(store.getState().workspace.activeId, "two");
  assert.equal(await store.dispatch(thunks.switchWorkspace("one")), false);
  response.resolve(ok(null));
  assert.equal(await switching, true);
  assert.equal(store.getState().workspace.activeId, "one");
  assert.equal(store.getState().auth.user.defaultWorkspaceId, "one");
  assert.equal(store.getState().auth.user.email, user.email);
  assert.equal(await store.dispatch(thunks.switchWorkspace("disabled")), false);
  assert.equal(await store.dispatch(thunks.switchWorkspace("not-a-member")), false);
  assert.equal(calls.filter(([kind]) => kind === "default").length, 1);
});

test("failed workspace switch retains the active workspace and can be retried", async () => {
  const { store, thunks, api } = fixture();
  await store.dispatch(thunks.loadWorkspaces());
  api.setDefault = async () => fail();
  assert.equal(await store.dispatch(thunks.switchWorkspace("one")), false);
  assert.equal(store.getState().workspace.activeId, "two");
  assert.equal(store.getState().auth.user.defaultWorkspaceId, "two");
  assert.ok(store.getState().workspace.switchError);
  api.setDefault = async () => ok(null);
  assert.equal(await store.dispatch(thunks.switchWorkspace("one")), true);
  assert.equal(store.getState().workspace.switchError, null);
});

test("list/detail failures are recoverable and the fresh disabled status replaces stale list data", async () => {
  const { store, thunks, api } = fixture();
  api.list = async () => fail();
  await store.dispatch(thunks.loadWorkspaces());
  assert.equal(store.getState().workspace.status, "error");
  api.list = async () => ok(items);
  api.detail = async () => fail();
  await store.dispatch(thunks.loadWorkspaces(true));
  assert.equal(store.getState().workspace.status, "ready");
  assert.equal(selectors.selectActiveWorkspace(store.getState()).id, "two");
  assert.ok(store.getState().workspace.detailError);
  api.detail = async () => ok({ ...items[1], status: "DISABLED" });
  await store.dispatch(thunks.refreshWorkspace("two"));
  assert.equal(selectors.selectActiveWorkspace(store.getState()).status, "DISABLED");
  assert.equal(store.getState().workspace.detailError, null);
});

test("logout/account changes clear workspace state and ignore a previous account's late requests", async () => {
  const { store, thunks, api, token } = fixture();
  const list = deferred();
  api.list = async () => list.promise;
  const loading = store.dispatch(thunks.loadWorkspaces());
  store.dispatch(authModule.signedOut());
  token("new-session");
  store.dispatch(authModule.setUser({ ...user, id: "other-user" }));
  list.resolve(ok(items));
  await loading;
  assert.deepEqual(store.getState().workspace.items, []);
  const ready = fixture();
  await ready.store.dispatch(ready.thunks.loadWorkspaces());
  const result = deferred();
  ready.api.setDefault = async () => result.promise;
  const switching = ready.store.dispatch(ready.thunks.switchWorkspace("one"));
  ready.store.dispatch(authModule.setUser({ ...user, id: "other-user" }));
  result.resolve(ok(null));
  assert.equal(await switching, false);
  assert.equal(ready.store.getState().workspace.ownerId, null);
  assert.deepEqual(ready.store.getState().workspace.items, []);
});

test("a late detail response cannot overwrite the workspace selected afterward", async () => {
  const { store, thunks, api } = fixture();
  await store.dispatch(thunks.loadWorkspaces());
  const old = deferred();
  api.detail = async (id) => (id === "two" ? old.promise : ok(items[0]));
  const refresh = store.dispatch(thunks.refreshWorkspace("two"));
  await store.dispatch(thunks.switchWorkspace("one"));
  old.resolve(ok({ ...items[1], name: "Stale workspace" }));
  await refresh;
  assert.equal(selectors.selectActiveWorkspace(store.getState()).name, "Sharma Insurance");
});

test("mobile navigation marks secondary/nested destinations without matching unrelated path prefixes", () => {
  assert.equal(navigation.activeDestination("/broadcasts/campaign-1").id, "broadcasts");
  assert.equal(navigation.activeDestination("/contacts?search=priya").id, "contacts");
  assert.equal(navigation.activeDestination("/contacts-other"), null);
  assert.equal(navigation.isPrimaryDestination("groups"), false);
  assert.equal(navigation.isPrimaryDestination("inbox"), true);
});

test("tab roots are the primary destinations plus More, and nested or secondary routes are not", () => {
  for (const path of ["/inbox", "/broadcasts", "/contacts", "/menu", "/inbox?filter=unread"])
    assert.equal(navigation.isTabRoot(path), true, path);
  for (const path of [
    "/groups",
    "/templates",
    "/broadcasts/campaign-1",
    "/menu-other",
    "/settings",
  ])
    assert.equal(navigation.isTabRoot(path), false, path);
});
