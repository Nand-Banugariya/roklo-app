import type { createApiClient, RequestOptions } from "@/services/api/create-client";
import type { ConversationPage } from "../../messaging/types";

export interface IncomingMessagePreference {
  enabled: boolean;
}

export function createNotificationApi(request: ReturnType<typeof createApiClient>) {
  return {
    incomingMessages: (options: RequestOptions = {}) =>
      request<IncomingMessagePreference>("/notifications/incoming-messages", options),
    setIncomingMessages: (enabled: boolean, options: RequestOptions = {}) =>
      request<IncomingMessagePreference>("/notifications/incoming-messages", {
        ...options,
        method: "PATCH",
        body: { enabled },
      }),
    register: (deviceToken: string, options: RequestOptions = {}) =>
      request<null>("/notifications/push-devices", {
        ...options,
        method: "POST",
        body: { providerId: "expo", deviceToken },
      }),
    // The existing API removes ALL Expo devices for this account.
    unregister: (options: RequestOptions = {}) =>
      request<null>("/notifications/push-devices/expo", {
        ...options,
        method: "DELETE",
      }),
    // Resolve number access through the API even when a push contains sessionId.
    conversation: (workspaceId: string, conversationId: string, options: RequestOptions = {}) =>
      request<ConversationPage>(
        `/w/${encodeURIComponent(workspaceId)}/inbox/conversations?${new URLSearchParams({ conversationId })}`,
        { ...options, envelope: false },
      ),
  };
}
