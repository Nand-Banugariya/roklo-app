import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { notificationTarget } from "../utils/notification-target";
import type { NotificationRuntime, NotificationTap } from "./notification-runtime.types";

export const notificationUnavailableReason =
  Platform.OS !== "ios" && Platform.OS !== "android"
    ? "Phone notifications are available in the Android and iOS app."
    : // expoVersion is undefined (not null) in native builds, so check the execution environment.
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? "Phone notifications need a native app build; they are unavailable in Expo Go."
      : null;

let runtime: Promise<NotificationRuntime> | null = null;
let foregroundEnabled = false;

export function loadNotificationRuntime(): Promise<NotificationRuntime | null> {
  if (notificationUnavailableReason) return Promise.resolve(null);
  runtime ??= import("expo-notifications")
    .then((notifications): NotificationRuntime => {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: foregroundEnabled,
          shouldShowList: foregroundEnabled,
          shouldPlaySound: foregroundEnabled,
          shouldSetBadge: false,
        }),
      });
      return {
        async permission(ask) {
          // Android 13 needs a channel before requesting POST_NOTIFICATIONS.
          if (Platform.OS === "android") {
            await Promise.all(
              [
                ["mentions", "Mentions"],
                ["messages", "Incoming messages"],
              ].map(([id, name]) =>
                notifications.setNotificationChannelAsync(id, {
                  name,
                  importance: notifications.AndroidImportance.HIGH,
                  sound: "default",
                  vibrationPattern: [0, 250, 250, 250],
                }),
              ),
            );
          }
          let permission = await notifications.getPermissionsAsync();
          const granted = () =>
            permission.granted ||
            permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
          if (ask && !granted() && permission.canAskAgain) {
            permission = await notifications.requestPermissionsAsync({
              ios: { allowAlert: true, allowSound: true, allowBadge: true },
            });
          }
          return { granted: granted(), canAskAgain: permission.canAskAgain };
        },
        async token() {
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
          if (!projectId)
            throw new Error("This app build is missing its notification project configuration.");
          try {
            return (await notifications.getExpoPushTokenAsync({ projectId })).data;
          } catch (error) {
            // Android builds without googleServicesFile cannot create an FCM token.
            if (
              Platform.OS === "android" &&
              error instanceof Error &&
              /firebase/i.test(error.message)
            ) {
              throw new Error(
                "This app build is missing its Android push setup (google-services.json). Install a build that includes it.",
              );
            }
            throw error;
          }
        },
        foreground(enabled) {
          foregroundEnabled = enabled;
        },
        async stop() {
          foregroundEnabled = false;
          notifications.clearLastNotificationResponse();
          await Promise.allSettled([
            notifications.unregisterForNotificationsAsync(),
            notifications.dismissAllNotificationsAsync(),
          ]);
        },
        listen(onTap, onToken) {
          const deliver = (response: import("expo-notifications").NotificationResponse | null) => {
            if (!response || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER)
              return;
            const target = notificationTarget(response.notification.request.content.data);
            notifications.clearLastNotificationResponse();
            if (target)
              onTap({
                id: response.notification.request.identifier,
                target,
              } satisfies NotificationTap);
          };
          const response = notifications.addNotificationResponseReceivedListener(deliver);
          const token = notifications.addPushTokenListener(onToken);
          deliver(notifications.getLastNotificationResponse());
          return () => {
            response.remove();
            token.remove();
          };
        },
      };
    })
    .catch((error: unknown) => {
      runtime = null;
      throw error;
    });
  return runtime;
}
