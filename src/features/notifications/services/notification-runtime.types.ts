import type { NotificationTarget } from "../utils/notification-target";

export interface NotificationTap {
  id: string;
  target: NotificationTarget;
}

export interface NotificationRuntime {
  permission: (ask: boolean) => Promise<{ granted: boolean; canAskAgain: boolean }>;
  token: () => Promise<string>;
  stop: () => Promise<void>;
  foreground: (enabled: boolean) => void;
  listen: (onTap: (tap: NotificationTap) => void, onToken: () => void) => () => void;
}
