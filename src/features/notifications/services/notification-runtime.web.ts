import type { NotificationRuntime } from "./notification-runtime.types";

export const notificationUnavailableReason =
  "Phone notifications are available in the Android and iOS app.";
export async function loadNotificationRuntime(): Promise<NotificationRuntime | null> {
  return null;
}
