import type { ChatMessage, Conversation, DeliveryStatus } from "../types";

// The web build keeps no copy on the device: expo-sqlite on web is alpha and needs wasm and cross-origin
// isolation headers. Every call answers "nothing cached", so chats load from the API as before. The phone
// apps use message-store.ts (SQLite).

export const MESSAGE_STORE_DB = "roklo-inbox.db";
export const CACHE_MESSAGES_PER_CHAT = 100;
export const CACHE_CHATS = 50;

export function setMessageStoreOwner(_userId: string, _workspaceId: string) {}
export const readCachedChat = async (_conversationId: string): Promise<{ messages: ChatMessage[]; conversation: Conversation | null }> =>
  ({ messages: [], conversation: null });
export const hasCachedChat = async (_conversationId: string) => false;
export const putCachedMessages = async (_messages: ChatMessage[], _sessionId?: string) => {};
export const replaceCachedWindow = async (_conversationId: string, _page: ChatMessage[], _sessionId?: string, _conversation?: Conversation) => {};
export const deleteCachedNumber = async (_sessionId: string) => {};
export const keepCachedNumbers = async (_sessionIds: string[]) => {};
export const patchCachedStatus = async (_messageId: string, _deliveryStatus: DeliveryStatus) => {};
export const pruneCache = async (_conversationId: string) => {};
export const deleteMessageStore = async () => {};
