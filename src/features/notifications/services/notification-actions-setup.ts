import type { NotificationResponse, NotificationTaskPayload } from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { env } from "@/config/env";
import { createMessagingApi } from "@/features/messaging/services/messaging-api";
import { createApiClient } from "@/services/api/create-client";
import { sessionStorage } from "@/services/storage/session-storage";
import {
  createNotificationActions,
  MARK_READ_ACTION,
  MESSAGE_ACTIONS,
  MESSAGE_CATEGORY,
  REPLY_ACTION,
} from "./notification-actions";
import { notificationUnavailableReason } from "./notification-runtime";

// Imported by the app entry, before any screen mounts, so the actions also work
// when the OS starts the app in the background just to handle a button press.
const ACTION_TASK = "roklo-notification-actions";

let loaded: Promise<typeof import("expo-notifications")> | null = null;
const notifications = () => (loaded ??= import("expo-notifications"));

const handle = createNotificationActions({
  // Read storage directly: restoring the shared session here could race the app's own restore.
  token: () => sessionStorage.read(),
  api: (workspaceId, token) => {
    const messaging = createMessagingApi(
      createApiClient({ baseUrl: env.apiBaseUrl, getToken: () => token }),
      workspaceId,
    );
    return { send: (id, text) => messaging.send(id, text, "REPLY"), markRead: messaging.markRead };
  },
  dismiss: async (id) => (await notifications()).dismissNotificationAsync(id),
  notifyFailure: async (target, { title, body }) =>
    (await notifications()).scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: { event: "inbox.message.received", ...target },
      },
      trigger: Platform.OS === "android" ? { channelId: "messages" } : null,
    }),
});

const handleResponse = (response: NotificationResponse) =>
  handle({
    notificationId: response.notification.request.identifier,
    actionIdentifier: response.actionIdentifier,
    userText: response.userText,
    data: response.notification.request.content.data,
  });

if (!notificationUnavailableReason) {
  // Android runs this task for presses while the app is backgrounded or closed.
  if (Platform.OS === "android") {
    TaskManager.defineTask<NotificationTaskPayload>(ACTION_TASK, async ({ data }) => {
      if (data && "actionIdentifier" in data) await handleResponse(data);
    });
  }
  void notifications()
    .then((runtime) => {
      // Every launch: a push only gets buttons if its category is already saved on the phone.
      void runtime
        .setNotificationCategoryAsync(MESSAGE_CATEGORY, MESSAGE_ACTIONS)
        .catch(() => undefined);
      if (Platform.OS === "android")
        void runtime.registerTaskAsync(ACTION_TASK).catch(() => undefined);
      runtime.addNotificationResponseReceivedListener((response) => {
        void handleResponse(response);
      });
      // iOS can deliver the press before this listener exists, e.g. after starting a closed app.
      const last = runtime.getLastNotificationResponse();
      if (
        last &&
        (last.actionIdentifier === REPLY_ACTION || last.actionIdentifier === MARK_READ_ACTION)
      ) {
        runtime.clearLastNotificationResponse();
        void handleResponse(last);
      }
    })
    .catch(() => undefined);
}
