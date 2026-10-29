import { apiRequest } from "@/services/api/client";
import { onboardingStorage } from "@/services/storage/onboarding-storage";
import { session } from "@/services/storage/session";
import { createNotificationApi } from "./notification-api";
import { createPushRegistration } from "./create-push-registration";
import { loadNotificationRuntime } from "./notification-runtime";

export const notificationApi = createNotificationApi(apiRequest);
export const pushRegistration = createPushRegistration({
  api: notificationApi,
  storage: onboardingStorage,
  runtime: loadNotificationRuntime,
  getToken: session.getToken,
});
