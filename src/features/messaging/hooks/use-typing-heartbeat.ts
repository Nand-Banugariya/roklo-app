import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useMessaging } from "../providers/messaging-context";

/** "typing" goes out at most this often; under the API's 6s auto-stop, or the customer's "typing…" flickers off. */
const TYPING_HEARTBEAT_MS = 4_000;
/** No keystroke for this long sends "paused". */
const TYPING_IDLE_MS = 3_000;

/**
 * Tells the API the agent is typing a reply (the web app's useTypingHeartbeat), so the customer sees
 * WhatsApp's "typing…" and teammates see who's replying. "paused" goes out when the draft empties,
 * after TYPING_IDLE_MS without a keystroke, on blur, when the app goes to the background, when
 * `enabled` turns off and on unmount — only if "typing" was sent. Sending a reply ends it on the server.
 */
export function useTypingHeartbeat(conversationId: string, enabled: boolean) {
  const { api } = useMessaging();
  const lastSentAt = useRef<number | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback((notify: boolean) => {
    if (idle.current) { clearTimeout(idle.current); idle.current = null; }
    const wasTyping = lastSentAt.current !== null;
    lastSentAt.current = null;
    if (wasTyping && notify) api.setTyping(conversationId, "paused");
  }, [api, conversationId]);
  /** Call with the draft after an edit the agent made (not a quick reply or a clear). */
  const onUserInput = useCallback((draft: string) => {
    if (!enabled) return;
    if (!draft.trim()) { stop(true); return; }
    const now = Date.now();
    if (lastSentAt.current === null || now - lastSentAt.current >= TYPING_HEARTBEAT_MS) {
      api.setTyping(conversationId, "typing");
      lastSentAt.current = now;
    }
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => stop(true), TYPING_IDLE_MS);
  }, [api, conversationId, enabled, stop]);
  const onBlur = useCallback(() => stop(true), [stop]);
  /** The reply was sent: the API already ended the typing. */
  const markSent = useCallback(() => stop(false), [stop]);
  // Note mode, another chat, unmount.
  useEffect(() => () => stop(true), [enabled, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") stop(true); });
    return () => subscription.remove();
  }, [stop]);
  return useMemo(() => ({ onUserInput, onBlur, markSent }), [onUserInput, onBlur, markSent]);
}
