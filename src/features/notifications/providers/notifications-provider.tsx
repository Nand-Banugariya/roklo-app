import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { session } from "@/services/storage/session";
import type { PushState } from "../services/create-push-registration";
import {
  loadNotificationRuntime,
  notificationUnavailableReason,
} from "../services/notification-runtime";
import { pushRegistration } from "../services/notification-service";

interface NotificationContext extends PushState {
  busy: boolean;
  unavailable: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  retryDevice: () => Promise<void>;
  incoming: { enabled: boolean; loaded: boolean; message: string | null };
  setIncomingEnabled: (enabled: boolean) => Promise<void>;
  retryIncoming: () => Promise<void>;
}
const Context = createContext<NotificationContext | null>(null);
type Action =
  { kind: "refresh" | "incoming-refresh" } | { kind: "device" | "incoming"; enabled: boolean };

/** Account-level, outside the workspace-keyed MessagingProvider. Never prompts on mount. */
export function NotificationsProvider({ userId, children }: PropsWithChildren<{ userId: string }>) {
  const [state, setState] = useState<PushState>({ enabled: false, blocked: false, message: null });
  const [incoming, setIncoming] = useState({
    enabled: false,
    loaded: false,
    message: null as string | null,
  });
  const [busy, setBusy] = useState(!notificationUnavailableReason);
  const pending = useRef(false);
  const alive = useRef(false);
  const handled = useRef<string | null>(null);
  const lastDevice = useRef(true);
  const lastIncoming = useRef<boolean | null>(null);
  const [auth] = useState(session.getToken);
  const run = useCallback(
    async (action: Action) => {
      if (
        !auth ||
        !userId ||
        !alive.current ||
        pending.current ||
        notificationUnavailableReason ||
        session.getToken() !== auth
      )
        return;
      pending.current = true;
      setBusy(true);
      const valid = () => alive.current && session.getToken() === auth;
      const updateDevice = async (enabled?: boolean) => {
        lastDevice.current = enabled ?? true;
        try {
          const next =
            enabled === false
              ? await pushRegistration.disable(userId, auth)
              : await pushRegistration.sync(userId, auth, enabled === true);
          if (valid()) setState(next);
          return next;
        } catch (error) {
          if (valid())
            setState((old) => ({
              ...old,
              message:
                error instanceof Error
                  ? error.message
                  : "Couldn't update phone notifications. Try again.",
            }));
          return null;
        }
      };
      const updateIncoming = async (enabled?: boolean) => {
        lastIncoming.current = enabled ?? null;
        if (valid()) setIncoming((old) => ({ ...old, message: null }));
        // Incoming alerts share the existing device registration with mentions.
        // Persist the account opt-in only after permission and registration succeed.
        if (enabled === true) {
          const push = await updateDevice(true);
          if (!valid()) return;
          if (!push?.enabled) {
            setIncoming((old) => ({
              ...old,
              message:
                "Incoming messages stay off until Phone notifications can be turned on. See the message above.",
            }));
            return;
          }
        }
        try {
          const next =
            enabled === undefined
              ? await pushRegistration.incomingPreference(auth)
              : await pushRegistration.setIncomingEnabled(userId, auth, enabled);
          if (next && valid()) {
            setIncoming({ ...next, loaded: true, message: null });
            lastIncoming.current = null;
          }
        } catch (error) {
          if (valid())
            setIncoming((old) => ({
              ...old,
              message:
                error instanceof Error
                  ? error.message
                  : "Couldn't update incoming message notifications. Try again.",
            }));
        }
      };
      try {
        if (action.kind === "device") await updateDevice(action.enabled);
        else if (action.kind === "incoming") await updateIncoming(action.enabled);
        else if (action.kind === "incoming-refresh") await updateIncoming();
        else await Promise.all([updateDevice(), updateIncoming()]);
      } finally {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [auth, userId],
  );

  useEffect(() => {
    alive.current = true;
    let disposed = false;
    let removeListeners: (() => void) | undefined;
    void loadNotificationRuntime()
      .then((runtime) => {
        if (disposed || !runtime || !auth || session.getToken() !== auth) return;
        removeListeners = runtime.listen(
          (tap) => {
            if (disposed || session.getToken() !== auth || handled.current === tap.id) return;
            handled.current = tap.id;
            router.push({ pathname: "/notification", params: { ...tap.target } });
          },
          () => {
            void run({ kind: "refresh" });
          },
        );
      })
      .catch(() => {
        if (!disposed) {
          setState((old) => ({
            ...old,
            message:
              "Phone notifications need a new app build. Install the latest build and try again.",
          }));
        }
      });
    void run({ kind: "refresh" });
    const foreground = AppState.addEventListener("change", (next) => {
      if (next === "active") void run({ kind: "refresh" });
    });
    return () => {
      alive.current = false;
      disposed = true;
      removeListeners?.();
      foreground.remove();
    };
  }, [auth, run]);

  return (
    <Context.Provider
      value={{
        ...state,
        busy,
        incoming,
        unavailable: notificationUnavailableReason,
        setEnabled: (enabled) => run({ kind: "device", enabled }),
        setIncomingEnabled: (enabled) => run({ kind: "incoming", enabled }),
        retryDevice: () => run({ kind: "device", enabled: lastDevice.current }),
        retryIncoming: () =>
          run(
            lastIncoming.current === null
              ? { kind: "incoming-refresh" }
              : { kind: "incoming", enabled: lastIncoming.current },
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error("useNotifications requires NotificationsProvider.");
  return value;
}
