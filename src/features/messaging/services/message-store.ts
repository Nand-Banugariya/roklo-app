import * as SQLite from "expo-sqlite";
import { session } from "@/services/storage/session";
import type { ChatMessage, Conversation, DeliveryStatus } from "../types";
import { statusMovesForward } from "../utils/message-order";

// A phone copy of opened chats' messages (SQLite), so a chat paints at once on reopening or after the
// app restarts while the API's newest page loads: the web app's IndexedDB cache (lib/inbox/message-cache.ts)
// with the same reads, writes, reconciling and eviction. It only ever holds copies of server data: every
// failure falls back to the API, and a database this build can't use is dropped and rebuilt, never migrated.
//
// Privacy: it belongs to one user in one workspace (checked on open, wiped on a mismatch) and is deleted on
// sign-out. It lives in the app's private storage, unencrypted like the web app's (SQLCipher needs a
// development build).

/** The database file; deleted on sign-out. */
export const MESSAGE_STORE_DB = "roklo-inbox.db";
/** Per-chat cap; well above a page (30) so reopening doesn't evict scrolled-back history. */
export const CACHE_MESSAGES_PER_CHAT = 100;
/** Chats that keep their messages; the least recently written are dropped. */
export const CACHE_CHATS = 50;
/** Bump to start over with a new layout: a cache needs no migration. */
const SCHEMA_VERSION = 1;

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    created_ms INTEGER NOT NULL,
    json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_by_chat ON messages (conversation_id, created_ms, id);
  CREATE TABLE IF NOT EXISTS threads (
    conversation_id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT,
    updated_at INTEGER NOT NULL,
    conversation_json TEXT
  );
  CREATE INDEX IF NOT EXISTS threads_by_age ON threads (updated_at);
  CREATE INDEX IF NOT EXISTS threads_by_number ON threads (session_id);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`;

const ms = (iso: string) => {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
};
const parse = (json: string): ChatMessage | null => {
  try {
    return JSON.parse(json) as ChatMessage;
  } catch {
    return null;
  }
};
/** Only server copies are kept: a message still sending never is. */
const storable = (messages: ChatMessage[]) =>
  messages.filter((message) => !message.id.startsWith("local-"));

let owner: string | null = null;
let ready: Promise<SQLite.SQLiteDatabase | null> | null = null;
/** Latched when SQLite can't be used at all, or a write failed: reads return nothing, writes are dropped. */
let unavailable = false;
/** Every operation runs in turn: SQLite allows one writer, and the order of writes matters. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.catch(() => undefined).then(task);
  queue = run;
  return run;
}

/** Sets whose copy this is (the messaging provider, per user and workspace). Another owner's copy is wiped on open. */
export function setMessageStoreOwner(userId: string, workspaceId: string) {
  const next = userId && workspaceId ? `${userId}:${workspaceId}` : null;
  if (next === owner) return;
  owner = next;
  ready = null;
}

/** Opens the database for the current owner, wiping another owner's copy or an unknown layout. */
async function open(key: string): Promise<SQLite.SQLiteDatabase> {
  let db = await SQLite.openDatabaseAsync(MESSAGE_STORE_DB);
  const version =
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))?.user_version ?? 0;
  if (version !== SCHEMA_VERSION && version !== 0) {
    // A layout this build doesn't know: it's only a cache, so start over.
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(MESSAGE_STORE_DB);
    db = await SQLite.openDatabaseAsync(MESSAGE_STORE_DB);
  }
  await db.execAsync(`${SCHEMA}\nPRAGMA user_version = ${SCHEMA_VERSION};`);
  const stored = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'owner'",
  );
  if (stored?.value !== key) {
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM messages");
      await db.runAsync("DELETE FROM threads");
      await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('owner', ?)", key);
    });
  }
  return db;
}

function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (unavailable || !owner) return Promise.resolve(null);
  if (!ready) {
    const key = owner;
    const opening = open(key).then(
      (db) => db,
      () => {
        unavailable = true;
        return null;
      },
    );
    ready = opening;
  }
  return ready;
}

/**
 * A failed write leaves the copy behind the server with nothing to catch it up (a full disk, say), so
 * the store stands down until the app restarts rather than show stale messages on the next open.
 */
function onWriteError(error: unknown) {
  console.warn("[message-store] write failed; using the API only", error);
  unavailable = true;
}

/** Marks the chat as just written, keeping its number label and details when the caller doesn't know them. */
async function touch(
  db: SQLite.SQLiteDatabase,
  conversationId: string,
  sessionId?: string,
  conversation?: Conversation,
) {
  await db.runAsync(
    `INSERT INTO threads (conversation_id, session_id, updated_at, conversation_json) VALUES (?, ?, ?, ?)
     ON CONFLICT(conversation_id) DO UPDATE SET updated_at = excluded.updated_at,
       session_id = COALESCE(excluded.session_id, threads.session_id),
       conversation_json = COALESCE(excluded.conversation_json, threads.conversation_json)`,
    conversationId,
    sessionId ?? null,
    Date.now(),
    conversation ? JSON.stringify(conversation) : null,
  );
}

async function putRows(db: SQLite.SQLiteDatabase, messages: ChatMessage[]) {
  for (const message of messages) {
    await db.runAsync(
      "INSERT OR REPLACE INTO messages (id, conversation_id, created_ms, json) VALUES (?, ?, ?, ?)",
      message.id,
      message.conversationId,
      ms(message.createdAt),
      JSON.stringify(message),
    );
  }
}

/** Deletes these chats' messages and bookkeeping. */
async function dropChats(db: SQLite.SQLiteDatabase, conversationIds: string[]) {
  if (!conversationIds.length) return;
  await db.withTransactionAsync(async () => {
    for (const id of conversationIds) {
      await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", id);
      await db.runAsync("DELETE FROM threads WHERE conversation_id = ?", id);
    }
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** One chat's cached messages, newest first (the thread's order), and its details; empty when nothing (or no store). */
export function readCachedChat(
  conversationId: string,
): Promise<{ messages: ChatMessage[]; conversation: Conversation | null }> {
  return serial(async () => {
    const db = await getDb();
    if (!db) return { messages: [], conversation: null };
    try {
      const rows = await db.getAllAsync<{ json: string }>(
        "SELECT json FROM messages WHERE conversation_id = ? ORDER BY created_ms DESC, id DESC",
        conversationId,
      );
      const thread = await db.getFirstAsync<{ conversation_json: string | null }>(
        "SELECT conversation_json FROM threads WHERE conversation_id = ?",
        conversationId,
      );
      let conversation: Conversation | null = null;
      try {
        conversation = thread?.conversation_json
          ? (JSON.parse(thread.conversation_json) as Conversation)
          : null;
      } catch {
        /* details are optional */
      }
      return {
        messages: rows
          .map((row) => parse(row.json))
          .filter((message): message is ChatMessage => !!message),
        conversation,
      };
    } catch {
      return { messages: [], conversation: null };
    }
  });
}

/** Whether a copy of this chat is kept (so a message for it, while closed, should be stored too). */
export function hasCachedChat(conversationId: string): Promise<boolean> {
  return serial(async () => {
    const db = await getDb();
    if (!db) return false;
    try {
      return !!(await db.getFirstAsync(
        "SELECT 1 FROM threads WHERE conversation_id = ?",
        conversationId,
      ));
    } catch {
      return false;
    }
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Stores messages by id: the same message again (an echo, media arriving, a reaction) updates in place. */
export function putCachedMessages(messages: ChatMessage[], sessionId?: string): Promise<void> {
  const rows = storable(messages);
  if (!rows.length) return Promise.resolve();
  return serial(async () => {
    const db = await getDb();
    if (!db) return;
    try {
      await db.withTransactionAsync(async () => {
        await putRows(db, rows);
        await touch(db, rows[0].conversationId, sessionId);
      });
    } catch (error) {
      onWriteError(error);
    }
  });
}

/**
 * Stores the API's newest page as the truth for its time window: cached messages inside it that the page
 * lacks were deleted and go. When the cached copy ends before the page starts, there may be a gap between
 * them, so the whole cached copy is replaced. Also keeps the chat's details for its header.
 */
export function replaceCachedWindow(
  conversationId: string,
  page: ChatMessage[],
  sessionId?: string,
  conversation?: Conversation,
): Promise<void> {
  const rows = storable(page);
  if (!rows.length) return Promise.resolve();
  return serial(async () => {
    const db = await getDb();
    if (!db) return;
    const times = rows.map((message) => ms(message.createdAt));
    const oldest = Math.min(...times);
    // Bounded above too: a socket message newer than the page isn't "missing" from it.
    const newest = Math.max(...times);
    const fresh = new Set(rows.map((message) => message.id));
    try {
      await db.withTransactionAsync(async () => {
        const cachedNewest = await db.getFirstAsync<{ created_ms: number }>(
          "SELECT created_ms FROM messages WHERE conversation_id = ? ORDER BY created_ms DESC LIMIT 1",
          conversationId,
        );
        if (cachedNewest && cachedNewest.created_ms < oldest) {
          await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", conversationId);
        } else {
          const inWindow = await db.getAllAsync<{ id: string }>(
            "SELECT id FROM messages WHERE conversation_id = ? AND created_ms BETWEEN ? AND ?",
            conversationId,
            oldest,
            newest,
          );
          for (const { id } of inWindow)
            if (!fresh.has(id)) await db.runAsync("DELETE FROM messages WHERE id = ?", id);
        }
        await putRows(db, rows);
        await touch(db, conversationId, sessionId, conversation);
      });
    } catch (error) {
      onWriteError(error);
    }
  });
}

/** Drops every cached chat on this number (it was removed from the workspace). */
export function deleteCachedNumber(sessionId: string): Promise<void> {
  return serial(async () => {
    const db = await getDb();
    if (!db) return;
    try {
      const ids = await db.getAllAsync<{ conversation_id: string }>(
        "SELECT conversation_id FROM threads WHERE session_id = ?",
        sessionId,
      );
      await dropChats(
        db,
        ids.map((row) => row.conversation_id),
      );
    } catch (error) {
      onWriteError(error);
    }
  });
}

/**
 * Drops cached chats on numbers the user no longer has (removed elsewhere, or access taken away).
 * `sessionIds` must be the complete current list. Chats with no number label yet are left for eviction.
 */
export function keepCachedNumbers(sessionIds: string[]): Promise<void> {
  return serial(async () => {
    const db = await getDb();
    if (!db) return;
    const current = new Set(sessionIds);
    try {
      const threads = await db.getAllAsync<{ conversation_id: string; session_id: string | null }>(
        "SELECT conversation_id, session_id FROM threads",
      );
      await dropChats(
        db,
        threads
          .filter((thread) => thread.session_id && !current.has(thread.session_id))
          .map((thread) => thread.conversation_id),
      );
    } catch (error) {
      onWriteError(error);
    }
  });
}

/** Moves a cached message's tick forward (never back); a no-op for one not cached. */
export function patchCachedStatus(
  messageId: string,
  deliveryStatus: DeliveryStatus,
): Promise<void> {
  return serial(async () => {
    const db = await getDb();
    if (!db) return;
    try {
      const row = await db.getFirstAsync<{ json: string }>(
        "SELECT json FROM messages WHERE id = ?",
        messageId,
      );
      const message = row ? parse(row.json) : null;
      if (!message || !statusMovesForward(message.deliveryStatus, deliveryStatus)) return;
      await db.runAsync(
        "UPDATE messages SET json = ? WHERE id = ?",
        JSON.stringify({ ...message, deliveryStatus }),
        messageId,
      );
    } catch (error) {
      onWriteError(error);
    }
  });
}

// ─── Eviction ────────────────────────────────────────────────────────────────

/**
 * Trims this chat to its cap (oldest first) and drops the least recently written chats past theirs. Only
 * run when a chat opens, never while paging back through it, so it can't delete history just loaded.
 */
export function pruneCache(conversationId: string): Promise<void> {
  return serial(async () => {
    const db = await getDb();
    if (!db) return;
    try {
      const total =
        (
          await db.getFirstAsync<{ n: number }>(
            "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?",
            conversationId,
          )
        )?.n ?? 0;
      if (total > CACHE_MESSAGES_PER_CHAT) {
        await db.runAsync(
          `DELETE FROM messages WHERE id IN (
          SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_ms ASC, id ASC LIMIT ?)`,
          conversationId,
          total - CACHE_MESSAGES_PER_CHAT,
        );
      }
      const threads = await db.getAllAsync<{ conversation_id: string }>(
        "SELECT conversation_id FROM threads ORDER BY updated_at ASC",
      );
      if (threads.length <= CACHE_CHATS) return;
      const evicted = threads
        .slice(0, threads.length - CACHE_CHATS)
        .map((thread) => thread.conversation_id)
        .filter((id) => id !== conversationId);
      await dropChats(db, evicted);
    } catch (error) {
      onWriteError(error);
    }
  });
}

// ─── Sign-out ────────────────────────────────────────────────────────────────

/** Deletes the whole database (sign-out, an expired session). */
export function deleteMessageStore(): Promise<void> {
  return serial(async () => {
    const db = await ready?.catch(() => null);
    ready = null;
    owner = null;
    try {
      await db?.closeAsync();
      await SQLite.deleteDatabaseAsync(MESSAGE_STORE_DB);
    } catch {
      // Nothing was stored yet.
    }
    // A fresh sign-in may use it again.
    unavailable = false;
  });
}

// The session only notifies on sign-out (and an expired token): the copy goes with it.
session.subscribe(() => {
  if (!session.getToken()) void deleteMessageStore();
});
