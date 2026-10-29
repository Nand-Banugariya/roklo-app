import type { createNotificationApi, IncomingMessagePreference } from "./notification-api";
import type { NotificationRuntime } from "./notification-runtime.types";

export interface PushState {
  enabled: boolean;
  blocked: boolean;
  message: string | null;
}
const off: PushState = { enabled: false, blocked: false, message: null };
const OWNER_KEY = "roklo.push.owner";
const preferenceKey = (userId: string) => `roklo.push.${userId}`;

export function createPushRegistration(deps: {
  api: ReturnType<typeof createNotificationApi>;
  storage: {
    read: (key: string) => Promise<string | null>;
    write: (key: string, value: string) => Promise<unknown>;
    remove: (key: string) => Promise<unknown>;
  };
  runtime: () => Promise<NotificationRuntime | null>;
  getToken: () => string | null;
}) {
  // Sign-out and registration share a queue: a late POST cannot run after DELETE.
  let queue: Promise<unknown> = Promise.resolve();
  let registered: { userId: string; auth: string; deviceToken: string } | null = null;
  let signingOutAuth: string | null = null;
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => undefined).then(task);
    queue = next;
    return next;
  }
  const current = (auth: string) => deps.getToken() === auth && signingOutAuth !== auth;

  return {
    incomingPreference(auth: string): Promise<IncomingMessagePreference | null> {
      return serial(async () => {
        if (!current(auth)) return null;
        const result = await deps.api.incomingMessages({ token: auth });
        if (!current(auth)) return null;
        if (!result.ok)
          throw new Error(
            result.message || "Couldn't load incoming message notifications. Try again.",
          );
        if (typeof result.data?.enabled !== "boolean")
          throw new Error("Couldn't read the notification preference. Try again.");
        return result.data;
      });
    },
    setIncomingEnabled(
      userId: string,
      auth: string,
      enabled: boolean,
    ): Promise<IncomingMessagePreference | null> {
      return serial(async () => {
        if (!current(auth)) return null;
        if (enabled && (registered?.userId !== userId || registered.auth !== auth)) {
          throw new Error("Turn on phone notifications before enabling incoming messages.");
        }
        const result = await deps.api.setIncomingMessages(enabled, { token: auth });
        if (!current(auth)) return null;
        if (!result.ok)
          throw new Error(
            result.message || "Couldn't update incoming message notifications. Try again.",
          );
        if (typeof result.data?.enabled !== "boolean" || result.data.enabled !== enabled) {
          throw new Error("Couldn't confirm the notification preference. Try again.");
        }
        return result.data;
      });
    },
    sync(userId: string, auth: string, ask = false): Promise<PushState> {
      return serial(async () => {
        const runtime = await deps.runtime();
        if (!runtime || !current(auth)) return off;
        if (ask) await deps.storage.write(preferenceKey(userId), "on");
        else if ((await deps.storage.read(preferenceKey(userId))) !== "on") return off;
        const owner = await deps.storage.read(OWNER_KEY);
        if (owner && owner !== userId)
          throw new Error(
            "This phone still has a notification registration for another account. Sign back into that account and turn off phone notifications before enabling them here.",
          );
        const permission = await runtime.permission(ask);
        if (!permission.granted) {
          runtime.foreground(false);
          return {
            ...off,
            blocked: !permission.canAskAgain,
            message: permission.canAskAgain
              ? "Allow notifications to receive alerts on this phone."
              : "Notifications are blocked. Allow them in your phone's settings, then return here.",
          };
        }
        const deviceToken = await runtime.token();
        if (!current(auth)) return off;
        // Record ownership BEFORE the request; a lost HTTP response may still have registered it.
        await deps.storage.write(OWNER_KEY, userId);
        if (!current(auth)) return off;
        if (
          registered?.userId !== userId ||
          registered.auth !== auth ||
          registered.deviceToken !== deviceToken
        ) {
          const result = await deps.api.register(deviceToken, { token: auth });
          if (!result.ok)
            throw new Error(result.message || "Couldn't enable phone notifications. Try again.");
          registered = { userId, auth, deviceToken };
        }
        if (!current(auth)) return off;
        await deps.storage.write(preferenceKey(userId), "on");
        if (!current(auth)) return off;
        runtime.foreground(true);
        return { enabled: true, blocked: false, message: null };
      });
    },
    disable(userId: string, auth: string): Promise<PushState> {
      return serial(async () => {
        if (!current(auth)) return off;
        const result = await deps.api.unregister({ token: auth });
        if (!result.ok)
          throw new Error(result.message || "Couldn't turn off phone notifications. Try again.");
        registered = null;
        await deps.storage.write(preferenceKey(userId), "off");
        if ((await deps.storage.read(OWNER_KEY)) === userId) await deps.storage.remove(OWNER_KEY);
        await (await deps.runtime())?.stop();
        return off;
      });
    },
    signOut(userId: string | null, auth: string | null): Promise<void> {
      // Block new work immediately, including a settings action queued during logout.
      signingOutAuth = auth;
      return serial(async () => {
        registered = null;
        try {
          if (userId && auth && (await deps.storage.read(OWNER_KEY)) === userId) {
            const result = await deps.api.unregister({ token: auth });
            if (result.ok) await deps.storage.remove(OWNER_KEY);
            // Failed cleanup keeps the ownership marker so another account cannot reuse it.
          }
        } finally {
          await (await deps.runtime())?.stop();
        }
      });
    },
    stopLocally(): Promise<void> {
      return serial(async () => {
        registered = null;
        await (await deps.runtime())?.stop();
      });
    },
  };
}
