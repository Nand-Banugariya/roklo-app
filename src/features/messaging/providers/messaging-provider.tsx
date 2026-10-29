import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import type { Socket } from "socket.io-client";
import { env } from "@/config/env";
import { apiRequest } from "@/services/api/client";
import { session } from "@/services/storage/session";
import { onboardingStorage as preferenceStorage } from "@/services/storage/onboarding-storage";
import { createMessagingApi } from "../services/messaging-api";
import { MessageStoreSync } from "../hooks/use-message-store-sync";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import { loadNumbers } from "../services/messaging-service";
import { messagingActions } from "../store/messaging-slice";
import { selectActiveNumber, selectNumbers } from "../store/messaging-selectors";
import { keepCachedNumbers, setMessageStoreOwner } from "../services/message-store";
import { clearPictures } from "../services/picture-cache";
import { createRealtimeSocket, JOINED_EVENT } from "../services/realtime";
import { MessagingContext } from "./messaging-context";
import { TypingProvider } from "./typing-provider";
import type { WhatsAppNumber } from "../types";

// Screens import useMessaging from here; hooks the provider renders import it from ./messaging-context.
export { useMessaging } from "./messaging-context";

/** Keyed by both user and workspace in AppShell so data cannot cross account boundaries. */
export function MessagingProvider({
  userId,
  workspaceId,
  children,
}: PropsWithChildren<{ userId: string; workspaceId: string }>) {
  const api = useMemo(() => createMessagingApi(apiRequest, workspaceId), [workspaceId]);
  // The phone's stored messages belong to this user and workspace (AppShell keys the provider by both);
  // set before any chat below reads them.
  useState(() => setMessageStoreOwner(userId, workspaceId));
  const storageKey = `roklo.number.${userId}.${workspaceId}`;
  // The numbers and the active one are in the `messaging` slice (loadNumbers); this provider loads them,
  // keeps them current from the socket, and remembers the picked one on this phone.
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { items: numbers, loading, error } = useAppSelector(selectNumbers);
  const activeNumber = useAppSelector(selectActiveNumber);
  const remembered = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  /** Re-reads the numbers; resolves to the complete list, or none when it failed. */
  const refreshNumbers = useCallback(async () => {
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    const rows = await dispatch(
      loadNumbers({ remembered: remembered.current, signal: pending.signal }),
    );
    if (!rows) return [] as WhatsAppNumber[];
    // The complete list: stored chats on numbers you no longer have go, as on the web app.
    void keepCachedNumbers(rows.map((row) => row.id));
    return rows;
  }, [dispatch]);
  useEffect(() => {
    let alive = true;
    void preferenceStorage
      .read(storageKey)
      .catch(() => null)
      .then((id) => {
        if (!alive) return;
        remembered.current = id;
        void refreshNumbers();
      });
    return () => {
      alive = false;
      controller.current?.abort();
    };
  }, [storageKey, refreshNumbers]);
  // One socket per user and workspace: AppShell keys this provider by both, so it is created once here.
  const [socket] = useState<Socket | null>(() =>
    userId && workspaceId && env.apiBaseUrl
      ? createRealtimeSocket({
          baseUrl: env.apiBaseUrl,
          getToken: session.getToken,
          userId,
          workspaceId,
        })
      : null,
  );
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!socket) return;
    const joined = () => setLive(true);
    const dropped = () => setLive(false);
    // A number connected, dropped or finished linking: its status pill and the reconnect dock follow.
    const numbersChanged = () => void refreshNumbers();
    socket.on(JOINED_EVENT, joined);
    socket.on("disconnect", dropped);
    socket.on("session.status", numbersChanged);
    socket.on("session.ready", numbersChanged);
    socket.connect();
    // Phones suspend sockets in the background; come back connected.
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active" && !socket.connected) socket.connect();
    });
    return () => {
      foreground.remove();
      socket.off(JOINED_EVENT, joined);
      socket.off("disconnect", dropped);
      socket.off("session.status", numbersChanged);
      socket.off("session.ready", numbersChanged);
      socket.disconnect();
    };
  }, [socket, refreshNumbers]);
  // Pictures belong to this user and workspace: forget them when either changes.
  // The inbox in the `messaging` slice (numbers, lists and opened chats) goes too, so the next account never sees this one's chats.
  useEffect(
    () => () => {
      clearPictures();
      dispatch(messagingActions.scopeChanged(null));
    },
    [dispatch],
  );
  const selectNumber = useCallback(
    (id: string) => {
      // Read now, not from the last render: a number just added by refreshNumbers() can be picked at once.
      if (!store.getState().messaging.numbers.items.some((number) => number.id === id)) return;
      remembered.current = id;
      dispatch(messagingActions.numberSelected(id));
      void preferenceStorage.write(storageKey, id).catch(() => undefined);
    },
    [dispatch, store, storageKey],
  );
  const value = useMemo(
    () => ({
      api,
      numbers,
      activeNumber,
      loading,
      error,
      refreshNumbers,
      selectNumber,
      socket,
      live,
      userId,
    }),
    [
      api,
      numbers,
      activeNumber,
      loading,
      error,
      refreshNumbers,
      selectNumber,
      socket,
      live,
      userId,
    ],
  );
  return (
    <MessagingContext.Provider value={value}>
      <TypingProvider>
        <MessageStoreSync />
        {children}
      </TypingProvider>
    </MessagingContext.Provider>
  );
}
