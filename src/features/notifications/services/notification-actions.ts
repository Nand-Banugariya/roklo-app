import type { NotificationAction } from "expo-notifications";
import type { ApiResult } from "@/services/api/create-client";
import { notificationTarget, type NotificationTarget } from "../utils/notification-target";

/** Incoming-message pushes set Expo's `categoryId` to this. Category ids must not contain `:` or `-`. */
export const MESSAGE_CATEGORY = "incoming_message";
export const REPLY_ACTION = "reply";
export const MARK_READ_ACTION = "mark_read";
/** iOS asks for unlock first: the access token is only readable while unlocked. */
export const MESSAGE_ACTIONS: NotificationAction[] = [
  {
    identifier: REPLY_ACTION,
    buttonTitle: "Reply",
    textInput: { submitButtonTitle: "Send", placeholder: "Message" },
    options: { opensAppToForeground: false, isAuthenticationRequired: true },
  },
  {
    identifier: MARK_READ_ACTION,
    buttonTitle: "Mark as read",
    options: { opensAppToForeground: false, isAuthenticationRequired: true },
  },
];

export interface NotificationActionResponse {
  notificationId: string;
  actionIdentifier: string;
  userText?: string;
  data: unknown;
}
export interface FailureContent {
  title: string;
  body: string;
}

export function createNotificationActions(deps: {
  token: () => Promise<string | null>;
  api: (
    workspaceId: string,
    token: string,
  ) => {
    send: (conversationId: string, text: string) => Promise<ApiResult<unknown>>;
    markRead: (conversationId: string) => Promise<ApiResult<unknown>>;
  };
  dismiss: (notificationId: string) => Promise<unknown>;
  notifyFailure: (target: NotificationTarget, content: FailureContent) => Promise<unknown>;
}) {
  // The listener, last response and Android task can all report the same press.
  const handled = new Set<string>();

  /** Returns false for presses that are not Reply or Mark as read, such as a plain tap. */
  return async function handle(response: NotificationActionResponse): Promise<boolean> {
    const { notificationId, actionIdentifier } = response;
    if (actionIdentifier !== REPLY_ACTION && actionIdentifier !== MARK_READ_ACTION) return false;
    const reply = actionIdentifier === REPLY_ACTION;
    const text = response.userText?.trim() ?? "";
    // An empty reply sends nothing and keeps the notification for another try.
    if (reply && !text) return true;
    const key = `${notificationId}\n${actionIdentifier}`;
    if (handled.has(key)) return true;
    handled.add(key);

    const target = notificationTarget(response.data);
    let failure: FailureContent | null = null;
    if (target) {
      try {
        const token = await deps.token();
        if (!token) throw new Error("Signed out.");
        const api = deps.api(target.workspaceId, token);
        const result = reply
          ? await api.send(target.conversationId, text)
          : await api.markRead(target.conversationId);
        if (!result.ok) {
          // A timeout or lost connection may still have reached the server.
          failure =
            reply && (result.reason === "network" || result.reason === "cancelled")
              ? {
                  title: "Reply may not have been sent",
                  body: "Tap to open the chat and check.",
                }
              : reply
                ? {
                    title: "Reply not sent",
                    body: "Tap to open the chat and try again.",
                  }
                : {
                    title: "Couldn't mark the chat as read",
                    body: "Tap to open the chat.",
                  };
        } else if (reply) {
          // Replying from WhatsApp's notification also reads the chat.
          await api.markRead(target.conversationId).catch(() => undefined);
        }
      } catch {
        failure = reply
          ? {
              title: "Reply not sent",
              body: "Tap to open the chat and try again.",
            }
          : {
              title: "Couldn't mark the chat as read",
              body: "Tap to open the chat.",
            };
      }
    }
    // Android keeps a spinner on a replied notification until it is removed.
    await deps.dismiss(notificationId).catch(() => undefined);
    if (target && failure) await deps.notifyFailure(target, failure).catch(() => undefined);
    return true;
  };
}
