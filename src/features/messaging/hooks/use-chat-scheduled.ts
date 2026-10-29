import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useMessaging } from "../providers/messaging-context";
import { JOINED_EVENT } from "../services/realtime";
import type { ScheduledMessage, ScheduledUpdatedEvent } from "../types";
import { useRealtimeEvent } from "./use-realtime-event";

const isOpen = (message: ScheduledMessage) =>
  ["PENDING", "PROCESSING", "FAILED"].includes(message.status);
const byTime = (a: ScheduledMessage, b: ScheduledMessage) =>
  Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id);

export function useChatScheduled(conversationId: string, enabled: boolean) {
  const { api } = useMessaging();
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reader = useRef<(() => Promise<void>) | null>(null);
  const reload = useCallback(() => {
    void reader.current?.();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let controller: AbortController | null = null;
      async function read() {
        if (AppState.currentState && AppState.currentState !== "active") return;
        controller?.abort();
        const current = new AbortController();
        controller = current;
        const collected: ScheduledMessage[] = [];
        let page = 1;
        for (;;) {
          const result = await api.scheduled(conversationId, page, current.signal);
          if (current.signal.aborted) return;
          if (!result.ok) {
            setError(result.message || "Couldn't load scheduled messages.");
            return;
          }
          collected.push(...result.data.data);
          if (!result.data.data.length || collected.length >= result.data.total) break;
          page += 1;
        }
        setItems(
          [...new Map(collected.filter(isOpen).map((item) => [item.id, item])).values()].sort(
            byTime,
          ),
        );
        setError(null);
      }
      reader.current = read;
      void read();
      const foreground = AppState.addEventListener("change", (state) => {
        if (state === "active") void read();
      });
      // Also recover after missed socket events while a message is being delivered.
      const timer = setInterval(() => void read(), 30_000);
      return () => {
        reader.current = null;
        controller?.abort();
        foreground.remove();
        clearInterval(timer);
      };
    }, [api, conversationId, enabled]),
  );
  useRealtimeEvent<ScheduledUpdatedEvent>(
    "inbox.scheduled.updated",
    (event) => {
      if (event.conversationId === conversationId) reload();
    },
    enabled,
  );
  useRealtimeEvent(JOINED_EVENT, reload, enabled);

  const put = useCallback(
    (message: ScheduledMessage) => {
      if (message.conversationId !== conversationId) return;
      setItems((old) => {
        const rest = old.filter((item) => item.id !== message.id);
        return (isOpen(message) ? [...rest, message] : rest).sort(byTime);
      });
      // Abort any older read that might otherwise put the previous state back.
      reload();
    },
    [conversationId, reload],
  );
  return { items, error, reload, put };
}
