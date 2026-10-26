import { useMessaging } from "../providers/messaging-context";
import { hasCachedChat, patchCachedStatus, putCachedMessages } from "../services/message-store";
import { openConversation } from "../services/open-conversation";
import type { MessageNewEvent, MessageStatusEvent } from "../types";
import { useRealtimeEvent } from "./use-realtime-event";

/**
 * Keeps the phone's stored copies of chats that aren't open current (the web app's useMessageCacheSync),
 * so reopening one doesn't paint stale messages before the API answers. The open chat keeps itself
 * current. Only chats already stored are fetched.
 */
export function useMessageStoreSync() {
  const { api } = useMessaging();
  useRealtimeEvent<MessageNewEvent>("inbox.message.new", (event) => {
    if (!event?.conversationId || event.conversationId === openConversation()) return;
    void hasCachedChat(event.conversationId).then((stored) => {
      if (!stored) return;
      void api.message(event.conversationId, event.messageId).then((result) => {
        if (result.ok && result.data?.id) void putCachedMessages([result.data]);
      });
    });
  });
  useRealtimeEvent<MessageStatusEvent>("inbox.message.status", (event) => {
    if (event?.conversationId && event.conversationId !== openConversation()) void patchCachedStatus(event.messageId, event.deliveryStatus);
  });
}

/** Mounted once inside the messaging provider. */
export function MessageStoreSync() {
  useMessageStoreSync();
  return null;
}
