import assert from "node:assert/strict";
import { test } from "node:test";
import { configureStore } from "@reduxjs/toolkit";
import "./register-typescript.mjs";

const [sliceModule, thunkModule, selectors, authModule, apiModule] = await Promise.all([
  import("../src/features/broadcasts/store/broadcasts-slice.ts"),
  import("../src/features/broadcasts/store/broadcasts-thunks.ts"),
  import("../src/features/broadcasts/store/broadcasts-selectors.ts"),
  import("../src/features/auth/store/auth-slice.ts"),
  import("../src/features/broadcasts/services/broadcasts-api.ts"),
]);
const ok = (data) => ({ ok: true, data, message: "OK" });
const fail = (status = 500, message = "") => ({ ok: false, reason: "failed", status, message });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const row = (id, overrides = {}) => ({
  id,
  name: `Broadcast ${id}`,
  status: "COMPLETED",
  sent: 1,
  ...overrides,
});
const run = (id, overrides = {}) => ({
  id,
  runNumber: 1,
  status: "COMPLETED",
  total: 1,
  sent: 1,
  failed: 0,
  delivered: null,
  read: null,
  replied: 0,
  ...overrides,
});
const summary = (id) => ({
  id,
  name: `Broadcast ${id}`,
  status: "SCHEDULED",
  failed: 0,
  totalRecipients: 1,
});

/** A store with the broadcasts slice, a workspace that can be switched, and fake services per workspace. */
function fixture(overrides = {}) {
  const calls = [];
  const api = (workspaceId) => ({
    list: async (query) => {
      calls.push(["list", workspaceId, query]);
      return ok({ broadcasts: [row(`${workspaceId}-1`)], total: 1, hasMore: false });
    },
    counts: async (search, tagIds) => {
      calls.push(["counts", search, tagIds]);
      return ok({ total: 1, counts: { COMPLETED: 1 } });
    },
    summary: async (id) => ok(summary(id)),
    // Twelve runs, newest first, ten a page.
    runs: async (id, page, limit) =>
      ok({
        runs: Array.from({ length: 12 }, (_, index) => run(`${id}-r${index + 1}`)).slice(
          (page - 1) * limit,
          page * limit,
        ),
        total: 12,
      }),
    run: async (id, runId) => ok(run(runId, { delivered: 1, read: 1 })),
    remove: async () => ok(null),
    resume: async () => ok(null),
    tags: async () => {
      calls.push(["tags"]);
      return ok([{ id: "t1", name: "Promo", color: null }]);
    },
    createTag: async (name, color) => ok({ id: "t0", name, color }),
    ...overrides.api?.(workspaceId, calls),
  });
  const messaging = () => ({
    contacts: async () => ok({ contacts: [], hasMore: false }),
    teams: async () => ok([]),
    members: async () => ok([]),
  });
  const thunks = thunkModule.createBroadcastsThunks({ api, messaging });
  const workspace = (state = { activeId: "ws1" }, action) =>
    action.type === "test/workspace" ? { activeId: action.payload } : state;
  const store = configureStore({
    reducer: { auth: authModule.default, workspace, broadcasts: sliceModule.default },
  });
  return {
    store,
    thunks,
    calls,
    switchTo: (id) => store.dispatch({ type: "test/workspace", payload: id }),
  };
}

test("the list loads into the slice with its counts, and a later page appends without duplicates", async () => {
  let page = 0;
  const { store, thunks } = fixture({
    api: () => ({
      list: async (query) => {
        page = query.page;
        return ok({
          broadcasts: page === 1 ? [row("a"), row("b")] : [row("b"), row("c")],
          total: 3,
          hasMore: page === 1,
        });
      },
    }),
  });
  await store.dispatch(thunks.loadBroadcasts());
  assert.deepEqual(
    selectors.selectBroadcastRows(store.getState()).map((item) => item.id),
    ["a", "b"],
  );
  assert.equal(selectors.selectBroadcastCounts(store.getState()).total, 1);
  await store.dispatch(thunks.loadBroadcasts("more"));
  assert.equal(page, 2);
  assert.deepEqual(selectors.selectBroadcastsList(store.getState()).ids, ["a", "b", "c"]);
  // No more pages: another "more" is a no-op.
  await store.dispatch(thunks.loadBroadcasts("more"));
  assert.equal(page, 2);
});

test("a late answer to an older list request is ignored", async () => {
  const first = deferred();
  let count = 0;
  const { store, thunks } = fixture({
    api: () => ({
      list: async () =>
        ++count === 1 ? first.promise : ok({ broadcasts: [row("new")], total: 1, hasMore: false }),
    }),
  });
  const older = store.dispatch(thunks.loadBroadcasts());
  await store.dispatch(thunks.loadBroadcasts());
  first.resolve(ok({ broadcasts: [row("old")], total: 1, hasMore: false }));
  await older;
  assert.deepEqual(selectors.selectBroadcastsList(store.getState()).ids, ["new"]);
});

test("a new filter or search starts the list over and reloads it; the same one does nothing", async () => {
  const { store, thunks, calls } = fixture();
  await store.dispatch(thunks.loadBroadcasts());
  await store.dispatch(thunks.setBroadcastsQuery({ filter: "PAUSED", search: "diwali" }));
  const lists = calls.filter(([kind]) => kind === "list");
  assert.equal(lists.length, 2);
  assert.deepEqual(
    [lists[1][2].filter, lists[1][2].search, lists[1][2].page],
    ["PAUSED", "diwali", 1],
  );
  await store.dispatch(thunks.setBroadcastsQuery({ filter: "PAUSED" }));
  assert.equal(calls.filter(([kind]) => kind === "list").length, 2);
});

test("another workspace starts the slice over, and a late answer from the old one is dropped", async () => {
  const late = deferred();
  const { store, thunks, switchTo } = fixture({
    api: (workspaceId) => (workspaceId === "ws1" ? { list: async () => late.promise } : {}),
  });
  const pending = store.dispatch(thunks.loadBroadcasts());
  switchTo("ws2");
  await store.dispatch(thunks.loadBroadcasts());
  late.resolve(ok({ broadcasts: [row("stale")], total: 1, hasMore: false }));
  await pending;
  const state = store.getState().broadcasts;
  assert.equal(state.workspaceId, "ws2");
  assert.deepEqual(state.list.ids, ["ws2-1"]);
  assert.equal(state.rows.stale, undefined);
});

test("a broadcast loads its summary and runs, older runs append, and a run's read adds its receipts", async () => {
  const { store, thunks } = fixture();
  await store.dispatch(thunks.loadBroadcast("b1"));
  let detail = selectors.selectBroadcastDetail(store.getState(), "b1");
  assert.equal(detail.status, "ready");
  assert.equal(detail.summary.id, "b1");
  assert.equal(detail.runIds.length, 10);
  assert.equal(detail.runTotal, 12);
  await store.dispatch(thunks.loadOlderRuns("b1"));
  detail = selectors.selectBroadcastDetail(store.getState(), "b1");
  assert.deepEqual(detail.runIds.slice(-3), ["b1-r10", "b1-r11", "b1-r12"]);
  assert.equal(detail.loadingRuns, false);
  await store.dispatch(thunks.loadRun("b1", "b1-r1"));
  assert.equal(selectors.selectRun(store.getState(), "b1-r1").delivered, 1);
  assert.equal(selectors.selectRunDetail(store.getState(), "b1-r1").status, "ready");
  // Re-reading the broadcast keeps the receipts a run's own read brought.
  await store.dispatch(thunks.loadBroadcast("b1"));
  assert.equal(selectors.selectRun(store.getState(), "b1-r1").delivered, 1);
});

test("a deleted broadcast reads as cancelled or deleted", async () => {
  const { store, thunks } = fixture({ api: () => ({ summary: async () => fail(404) }) });
  await store.dispatch(thunks.loadBroadcast("gone"));
  const detail = selectors.selectBroadcastDetail(store.getState(), "gone");
  assert.equal(detail.status, "error");
  assert.equal(detail.error, "This broadcast was cancelled or deleted.");
});

test("removing a broadcast drops it from the list at once; a failed change returns the API's message", async () => {
  const { store, thunks } = fixture({
    api: () => ({
      list: async () => ok({ broadcasts: [row("a"), row("b")], total: 2, hasMore: false }),
      resume: async () => fail(400, "Its end date has passed."),
    }),
  });
  await store.dispatch(thunks.loadBroadcasts());
  await store.dispatch(thunks.loadBroadcast("a"));
  const removing = store.dispatch(thunks.removeBroadcast("a"));
  const result = await removing;
  assert.equal(result.ok, true);
  assert.equal(selectors.selectBroadcastRow(store.getState(), "a"), null);
  assert.equal(selectors.selectBroadcastDetail(store.getState(), "a"), null);
  const resumed = await store.dispatch(thunks.resumeBroadcast("b"));
  assert.deepEqual([resumed.ok, resumed.message], [false, "Its end date has passed."]);
});

test("tags load once, and a new tag joins them in name order", async () => {
  const { store, thunks, calls } = fixture();
  await store.dispatch(thunks.loadTags());
  await store.dispatch(thunks.loadTags());
  assert.equal(calls.filter(([kind]) => kind === "tags").length, 1);
  const result = await store.dispatch(thunks.createTag("Diwali", "#16a34a"));
  assert.equal(result.ok, true);
  assert.deepEqual(
    selectors.selectBroadcastTags(store.getState()).items.map((tag) => tag.name),
    ["Diwali", "Promo"],
  );
});

test("signing out clears every broadcast", async () => {
  const { store, thunks } = fixture();
  await store.dispatch(thunks.loadBroadcasts());
  store.dispatch(authModule.signedOut());
  assert.deepEqual(store.getState().broadcasts, sliceModule.initialBroadcastsState());
});

test("a tag filter reaches the list and the counts; the same tags in another order don't reload", async () => {
  const { store, thunks, calls } = fixture();
  await store.dispatch(thunks.loadBroadcasts());
  await store.dispatch(thunks.setBroadcastsQuery({ filter: "PAUSED", tagIds: ["t2", "t1"] }));
  const lists = calls.filter(([kind]) => kind === "list");
  assert.deepEqual(lists.at(-1)[2].tagIds, ["t1", "t2"]);
  assert.equal(lists.at(-1)[2].filter, "PAUSED");
  assert.deepEqual(calls.filter(([kind]) => kind === "counts").at(-1)[2], ["t1", "t2"]);
  await store.dispatch(thunks.setBroadcastsQuery({ tagIds: ["t1", "t2"] }));
  assert.equal(calls.filter(([kind]) => kind === "list").length, lists.length);
  // Dropping the tags is a change again.
  await store.dispatch(thunks.setBroadcastsQuery({ tagIds: [] }));
  assert.deepEqual(calls.filter(([kind]) => kind === "list").at(-1)[2].tagIds, []);
});

test("the list and counts requests send tags as the web does", async () => {
  const paths = [];
  const api = apiModule.createBroadcastsApi(async (path) => {
    paths.push(path);
    return ok({ campaigns: [], total: 0, hasMore: false });
  }, "ws1");
  await api.list({ page: 1, limit: 20, tagIds: ["a", "b"] });
  await api.counts("diwali", ["a", "b"]);
  await api.counts("");
  assert.match(paths[0], /[?&]tagIds=a%2Cb(&|$)/);
  assert.match(paths[1], /\/counts\?name=diwali&tagIds=a%2Cb$/);
  assert.match(paths[2], /\/counts$/);
});
