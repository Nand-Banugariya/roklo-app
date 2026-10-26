import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import type { Socket } from "socket.io-client";
import { env } from "@/config/env";
import { apiRequest } from "@/services/api/client";
import { session } from "@/services/storage/session";
import { onboardingStorage as preferenceStorage } from "@/services/storage/onboarding-storage";
import { createMessagingApi } from "../services/messaging-api";
import { MessageStoreSync } from "../hooks/use-message-store-sync";
import { clearInboxCache } from "../services/inbox-cache";
import { keepCachedNumbers, setMessageStoreOwner } from "../services/message-store";
import { clearPictures } from "../services/picture-cache";
import { createRealtimeSocket, JOINED_EVENT } from "../services/realtime";
import { MessagingContext } from "./messaging-context";
import { TypingProvider } from "./typing-provider";
import { chooseNumber, type WhatsAppNumber } from "../types";

// Screens import useMessaging from here; hooks the provider renders import it from ./messaging-context.
export { useMessaging } from "./messaging-context";

/** Keyed by both user and workspace in AppShell so data cannot cross account boundaries. */
export function MessagingProvider({ userId, workspaceId, children }: PropsWithChildren<{ userId: string; workspaceId: string }>) {
  const api = useMemo(() => createMessagingApi(apiRequest, workspaceId), [workspaceId]);
  // The phone's stored messages belong to this user and workspace (AppShell keys the provider by both);
  // set before any chat below reads them.
  useState(() => setMessageStoreOwner(userId, workspaceId));
  const storageKey = `roklo.number.${userId}.${workspaceId}`;
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const remembered = useRef<string | null>(null);
  const numberRows = useRef<WhatsAppNumber[]>([]);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const refreshNumbers = useCallback(async () => {
    if (!workspaceId || !userId) { setLoading(false); return []; }
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    const rows: WhatsAppNumber[] = [];
    for (let offset = 0; ; offset += 50) {
      const result = await api.numbers(offset, pending.signal);
      if (!alive.current || pending.signal.aborted) return [];
      if (!result.ok) { setError(result.message || "Couldn't load your WhatsApp numbers."); setLoading(false); return []; }
      rows.push(...result.data.sessions);
      if (result.data.sessions.length < 50) break;
    }
    numberRows.current = rows;
    setNumbers(rows);
    // The complete list: stored chats on numbers you no longer have go, as on the web app.
    void keepCachedNumbers(rows.map((row) => row.id));
    const next = chooseNumber(rows, remembered.current);
    remembered.current = next?.id ?? null;
    setActiveId(next?.id ?? null);
    setError(null);
    setLoading(false);
    return rows;
  }, [api, workspaceId, userId]);
  useEffect(() => {
    alive.current = true;
    void preferenceStorage.read(storageKey).catch(() => null).then((id) => {
      if (!alive.current) return;
      remembered.current = id;
      void refreshNumbers();
    });
    return () => { alive.current = false; controller.current?.abort(); };
  }, [storageKey, refreshNumbers]);
  // One socket per user and workspace: AppShell keys this provider by both, so it is created once here.
  const [socket] = useState<Socket | null>(() => userId && workspaceId && env.apiBaseUrl
    ? createRealtimeSocket({ baseUrl: env.apiBaseUrl, getToken: session.getToken, userId, workspaceId }) : null);
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
    const foreground = AppState.addEventListener("change", (state) => { if (state === "active" && !socket.connected) socket.connect(); });
    return () => {
      foreground.remove();
      socket.off(JOINED_EVENT, joined); socket.off("disconnect", dropped);
      socket.off("session.status", numbersChanged); socket.off("session.ready", numbersChanged);
      socket.disconnect();
    };
  }, [socket, refreshNumbers]);
  // Pictures belong to this user and workspace: forget them when either changes.
  useEffect(() => () => { clearPictures(); clearInboxCache(); }, []);
  const selectNumber = useCallback((id: string) => {
    if (!numberRows.current.some((number) => number.id === id)) return;
    remembered.current = id;
    setActiveId(id);
    void preferenceStorage.write(storageKey, id).catch(() => undefined);
  }, [storageKey]);
  const value = useMemo(() => ({ api, numbers, activeNumber: numbers.find((number) => number.id === activeId) ?? null,
    loading, error, refreshNumbers, selectNumber, socket, live, userId }), [api, numbers, activeId, loading, error, refreshNumbers, selectNumber, socket, live, userId]);
  return <MessagingContext.Provider value={value}><TypingProvider><MessageStoreSync />{children}</TypingProvider></MessagingContext.Provider>;
}
