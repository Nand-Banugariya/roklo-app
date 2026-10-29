import assert from "node:assert/strict";
import { test } from "node:test";
import { configureStore } from "@reduxjs/toolkit";
import "./register-typescript.mjs";

const [sliceModule, thunkModule, selectors] = await Promise.all([
  import("../src/features/messaging/store/messaging-slice.ts"),
  import("../src/features/messaging/store/messaging-thunks.ts"),
  import("../src/features/messaging/store/messaging-selectors.ts"),
]);
const {
  default: messaging,
  messagingActions: actions,
  conversationListKey,
  LIST_LIMIT,
} = sliceModule;
const ok = (data) => ({ ok: true, data, message: "OK" });
const fail = (message = "") => ({ ok: false, reason: "failed", status: 500, message });
const chat = (id, overrides = {}) => ({
  id,
  sessionId: "s1",
  name: `Chat ${id}`,
  unreadCount: 0,
  status: "OPEN",
  ...overrides,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** A store with the messaging slice, a signed-in user and an active workspace (both switchable). */
function fixture(conversations) {
  const calls = [];
  const auth = (state = { user: { id: "u1" } }, action) =>
    action.type === "test/user" ? { user: action.payload } : state;
  const workspace = (state = { activeId: "w1" }, action) =>
    action.type === "test/workspace" ? { activeId: action.payload } : state;
  const store = configureStore({ reducer: { auth, workspace, messaging } });
  const { loadConversations } = thunkModule.createMessagingThunks({
    api: (workspaceId) => ({
      conversations: (sessionId, filter, search, page, signal) => {
        calls.push([workspaceId, sessionId, filter, search, page]);
        return conversations(page, signal);
      },
    }),
  });
  return { store, calls, loadConversations, select: selectors.makeSelectListRows() };
}
const load = (store, loadConversations, page = 1, mode = "quiet", extra = {}) =>
  store.dispatch(
    loadConversations({
      key: conversationListKey("s1", "all", ""),
      sessionId: "s1",
      filter: "all",
      search: "",
      page,
      mode,
      ...extra,
    }),
  );
const key = conversationListKey("s1", "all", "");

test("a list loads into the slice, pages add to it, and another number's rows are left out", async () => {
  const { store, calls, loadConversations, select } = fixture(async (page) =>
    ok({
      data:
        page === 1
          ? [chat("a"), chat("b"), chat("x", { sessionId: "s2" })]
          : [chat("b"), chat("c")],
      limit: 2,
      total: 3,
    }),
  );
  assert.equal(
    selectors.selectConversationList(store.getState(), key),
    null,
    "nothing until it's asked for",
  );
  await load(store, loadConversations);
  assert.deepEqual(
    select(store.getState(), key).map((row) => row.id),
    ["a", "b"],
  );
  const list = selectors.selectConversationList(store.getState(), key);
  assert.deepEqual([list.page, list.more, list.loading], [1, true, false]);
  await load(store, loadConversations, 2, "more");
  assert.deepEqual(
    select(store.getState(), key).map((row) => row.id),
    ["a", "b", "c"],
    "no chat twice",
  );
  assert.equal(selectors.selectConversationList(store.getState(), key).more, false);
  assert.deepEqual(
    calls.map((call) => call[0]),
    ["w1", "w1"],
  );
});

test("quiet refreshes keep the rows; a failure keeps them too and says why", async () => {
  let answer = ok({ data: [chat("a")], limit: 20, total: 1 });
  const { store, loadConversations, select } = fixture(async () => answer);
  await load(store, loadConversations);
  answer = fail("Server down");
  const pending = load(store, loadConversations, 1, "pull");
  assert.equal(
    selectors.selectConversationList(store.getState(), key).refreshing,
    true,
    "a pull shows its spinner",
  );
  assert.equal(
    selectors.selectConversationList(store.getState(), key).loading,
    false,
    "no skeleton over rows",
  );
  await pending;
  const list = selectors.selectConversationList(store.getState(), key);
  assert.deepEqual([list.error, list.refreshing], ["Server down", false]);
  assert.deepEqual(
    select(store.getState(), key).map((row) => row.id),
    ["a"],
  );
});

test("an older request's late answer, or one for a workspace left meanwhile, is dropped", async () => {
  const first = deferred();
  let calls = 0;
  const { store, loadConversations, select } = fixture(async () =>
    ++calls === 1 ? first.promise : ok({ data: [chat("new")], limit: 20, total: 1 }),
  );
  const older = load(store, loadConversations);
  await load(store, loadConversations);
  first.resolve(ok({ data: [chat("old")], limit: 20, total: 1 }));
  assert.equal(await older, null);
  assert.deepEqual(
    select(store.getState(), key).map((row) => row.id),
    ["new"],
  );

  const late = deferred();
  const other = fixture(async () => late.promise);
  const pending = load(other.store, other.loadConversations);
  other.store.dispatch({ type: "test/workspace", payload: "w2" });
  late.resolve(ok({ data: [chat("w1-chat")], limit: 20, total: 1 }));
  assert.equal(await pending, null);
  assert.equal(
    other.select(other.store.getState(), key).length,
    0,
    "nothing from the old workspace shows",
  );
});

test("another user or workspace starts the inbox over", async () => {
  const { store, loadConversations } = fixture(async () =>
    ok({ data: [chat("a")], limit: 20, total: 1 }),
  );
  await load(store, loadConversations);
  store.dispatch({ type: "test/workspace", payload: "w2" });
  await load(store, loadConversations);
  assert.equal(store.getState().messaging.scope, "u1:w2");
  assert.deepEqual(
    Object.keys(store.getState().messaging.lists),
    [key],
    "the old workspace's lists went",
  );
});

test("a chat is kept once: patches, live updates and removals show in every list", async () => {
  const { store, loadConversations } = fixture(async () =>
    ok({ data: [chat("a", { unreadCount: 1 })], limit: 20, total: 1 }),
  );
  await load(store, loadConversations);
  const unread = conversationListKey("s1", "unread", "");
  await store.dispatch(
    loadConversations({ key: unread, sessionId: "s1", filter: "unread", search: "", page: 1 }),
  );
  const rowsOf = (listKey) => selectors.makeSelectListRows()(store.getState(), listKey);
  store.dispatch(actions.conversationsPatched({ a: { isPinned: true } }));
  assert.equal(rowsOf(key)[0].isPinned, true);
  assert.equal(rowsOf(unread)[0].isPinned, true, "the other list follows");
  store.dispatch(
    actions.conversationUpdated({
      conversationId: "a",
      lastMessageAt: "t2",
      lastMessagePreview: "Hi",
      status: "AWAITING_REPLY",
      unreadIncrement: 2,
    }),
  );
  assert.deepEqual([rowsOf(key)[0].unreadCount, rowsOf(key)[0].lastMessagePreview], [3, "Hi"]);
  store.dispatch(
    actions.mentionsResolved({
      id: "a",
      lastMessageAt: "old",
      lastMessagePreview: "Hi",
      lastMessageMentionedParticipants: [{}],
    }),
  );
  assert.equal(
    rowsOf(key)[0].lastMessageMentionedParticipants,
    undefined,
    "mentions for an older last message are ignored",
  );
  store.dispatch(actions.conversationsRemoved(["a"]));
  assert.deepEqual([rowsOf(key).length, rowsOf(unread).length], [0, 0]);
  assert.equal(selectors.selectConversation(store.getState(), "a"), null);
});

test("chats read in the thread are kept until the list takes them, once each", () => {
  const store = configureStore({ reducer: { messaging } });
  store.dispatch(actions.readLocally("c1"));
  store.dispatch(actions.readLocally("c1"));
  assert.deepEqual(store.getState().messaging.readLocally, ["c1"]);
  store.dispatch(actions.readLocallyTaken());
  assert.deepEqual(store.getState().messaging.readLocally, []);
});

test("only the most recent lists are kept, and chats no list shows go with them", async () => {
  const { store, loadConversations } = fixture(async (_page) =>
    ok({
      data: [chat(`only-${store.getState().messaging.listOrder.length}`)],
      limit: 20,
      total: 1,
    }),
  );
  for (let index = 0; index <= LIST_LIMIT; index++)
    await store.dispatch(
      loadConversations({
        key: `s1:all:${index}`,
        sessionId: "s1",
        filter: "all",
        search: String(index),
        page: 1,
      }),
    );
  const { lists, listOrder, conversations } = store.getState().messaging;
  assert.equal(listOrder.length, LIST_LIMIT);
  assert.equal(lists["s1:all:0"], undefined, "the oldest list went");
  assert.equal(conversations["only-0"], undefined, "its chat went with it");
});

test("opened chats are kept without optimistic copies, the most recent ones, and go with a removed chat", () => {
  const { THREAD_LIMIT } = sliceModule;
  const store = configureStore({ reducer: { messaging } });
  const thread = (messages = []) => ({
    conversation: chat("c1"),
    cursor: null,
    hasMore: false,
    messages,
  });
  store.dispatch(
    actions.threadSaved({ id: "c1", thread: thread([{ id: "m1" }, { id: "local-123" }]) }),
  );
  assert.deepEqual(
    selectors.selectThread(store.getState(), "c1").messages.map((m) => m.id),
    ["m1"],
    "a message still sending is never kept",
  );
  store.dispatch(actions.conversationsRemoved(["c1"]));
  assert.equal(
    selectors.selectThread(store.getState(), "c1"),
    null,
    "a removed chat's thread goes",
  );
  store.dispatch(actions.threadSaved({ id: "c1", thread: thread() }));
  for (let index = 0; index < THREAD_LIMIT; index++)
    store.dispatch(actions.threadSaved({ id: `t${index}`, thread: thread() }));
  assert.equal(
    selectors.selectThread(store.getState(), "c1"),
    null,
    "only the most recent chats are kept",
  );
  assert.equal(store.getState().messaging.threadOrder.length, THREAD_LIMIT);
  store.dispatch(actions.scopeChanged(null));
  assert.equal(
    selectors.selectThread(store.getState(), `t${THREAD_LIMIT - 1}`),
    null,
    "signing out forgets them",
  );
});

/** A store and loadNumbers whose API answers `pages` in order (each a list of sessions). */
function numbersFixture(pages) {
  const auth = (state = { user: { id: "u1" } }) => state;
  const workspace = (state = { activeId: "w1" }, action) =>
    action.type === "test/workspace" ? { activeId: action.payload } : state;
  const store = configureStore({ reducer: { auth, workspace, messaging } });
  const offsets = [];
  const { loadNumbers } = thunkModule.createMessagingThunks({
    api: () => ({
      numbers: async (offset) => {
        offsets.push(offset);
        return pages(offset);
      },
    }),
  });
  return { store, offsets, loadNumbers };
}
const number = (id, connected = true) => ({
  id,
  status: connected ? "WORKING" : "STOPPED",
  isWhatsAppConnected: connected,
});

test("numbers load every page, and the one to work from is the remembered one, else the first connected", async () => {
  const many = Array.from({ length: 50 }, (_, index) => number(`n${index}`, index > 0));
  const { store, offsets, loadNumbers } = numbersFixture(async (offset) =>
    ok({ sessions: offset === 0 ? many : [number("last")] }),
  );
  assert.equal(
    store.getState().messaging.numbers.loading,
    true,
    "the inbox waits on the first list",
  );
  const rows = await store.dispatch(loadNumbers({ remembered: "gone" }));
  assert.deepEqual(offsets, [0, 50], "pages of 50 until a short one");
  assert.equal(rows.length, 51);
  assert.equal(
    selectors.selectActiveNumber(store.getState()).id,
    "n1",
    "a remembered number that's gone falls back to the first connected",
  );
  store.dispatch(actions.numberSelected("last"));
  store.dispatch(actions.numberSelected("missing"));
  assert.equal(
    selectors.selectActiveNumber(store.getState()).id,
    "last",
    "only a number in the list can be picked",
  );
  await store.dispatch(loadNumbers({ remembered: "n5" }));
  assert.equal(
    selectors.selectActiveNumber(store.getState()).id,
    "last",
    "a refresh keeps the number in use",
  );
});

test("a failed refresh keeps the numbers and says why; an older refresh's late answer is dropped", async () => {
  let answer = ok({ sessions: [number("a")] });
  const { store, loadNumbers } = numbersFixture(async () => answer);
  await store.dispatch(loadNumbers());
  answer = fail("Offline");
  assert.equal(await store.dispatch(loadNumbers()), null);
  const numbers = store.getState().messaging.numbers;
  assert.deepEqual(
    [numbers.items.map((row) => row.id), numbers.error, numbers.loading],
    [["a"], "Offline", false],
  );

  const first = deferred();
  let call = 0;
  const race = numbersFixture(async () =>
    ++call === 1 ? first.promise : ok({ sessions: [number("new")] }),
  );
  const older = race.store.dispatch(race.loadNumbers());
  await race.store.dispatch(race.loadNumbers());
  first.resolve(ok({ sessions: [number("old")] }));
  assert.equal(await older, null);
  assert.deepEqual(
    race.store.getState().messaging.numbers.items.map((row) => row.id),
    ["new"],
  );
});
