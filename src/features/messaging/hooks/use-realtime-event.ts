import { useEffect, useRef } from "react";
import { useMessaging } from "../providers/messaging-context";

/**
 * Calls `handler` for each `event` the API sends over the workspace socket while `enabled`.
 * The latest `handler` is always used, so it needn't be memoised.
 */
export function useRealtimeEvent<T = unknown>(event: string, handler: (data: T) => void, enabled = true) {
  const { socket } = useMessaging();
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    if (!enabled || !socket) return;
    const listener = (data: T) => latest.current(data);
    socket.on(event, listener);
    return () => { socket.off(event, listener); };
  }, [socket, event, enabled]);
}
