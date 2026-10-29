import type { ChatMessage } from "../types";
import { attachmentKind, attachmentName } from "./attachments";
import { resolveMentionText } from "./mentions";

/** WhatsApp's quick reactions, as on the web app. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
/** Pins a chat can hold (the API's cap, as on WhatsApp). */
export const MAX_PINNED_MESSAGES = 3;
/** Chats one forward can go to, and messages forwarded at once (the API's caps). */
export const FORWARD_MAX_TARGETS = 25;
export const FORWARD_MAX_MESSAGES = 10;

/** One line for a message (quotes, the pinned bar, the forward screen): its text, else what it carries. */
export function messageSummary(
  message: Pick<
    ChatMessage,
    "body" | "files" | "fileNames" | "contentType" | "mentionedParticipants"
  >,
) {
  const text = message.body?.trim();
  if (text) return resolveMentionText(text, message.mentionedParticipants);
  if (message.contentType === "POLL") return "Poll";
  if (message.contentType === "CONTACT_CARD") return "Contact card";
  if (message.contentType === "VOICE") return "Voice message";
  const files = message.files ?? [];
  if (files.length === 1) {
    const kind = attachmentKind(files[0], message.fileNames?.[0]);
    return kind === "image"
      ? "Photo"
      : kind === "video"
        ? "Video"
        : kind === "audio"
          ? "Audio"
          : attachmentName(files[0], message.fileNames?.[0]);
  }
  if (files.length > 1) return `${files.length} attachments`;
  return "Message";
}

/** Sent or received messages with something in them; never a private note, a system line or a deleted message. */
export function canForward(message: ChatMessage) {
  if (message.type !== "REPLY" || message.isRevoked || message.id.startsWith("local-"))
    return false;
  return Boolean(message.body?.trim() || message.files?.length || message.richContent);
}

/** Reactions go out on WhatsApp: not on a private note, a system line, a deleted or an unsent message. */
export const canReact = (message: ChatMessage) =>
  message.type === "REPLY" &&
  !message.isRevoked &&
  !message.id.startsWith("local-") &&
  message.deliveryStatus !== "FAILED";

/** Your own reaction on a message, if any. */
export const myReaction = (message: ChatMessage, userId: string) =>
  message.reactions?.find((reaction) => reaction.reactorUserId === userId)?.emoji ?? null;

/** Reacting with the emoji you already used takes it off, as on WhatsApp; anything else replaces it. */
export function nextReactions(message: ChatMessage, userId: string, emoji: string) {
  const others = (message.reactions ?? []).filter((reaction) => reaction.reactorUserId !== userId);
  const removing = myReaction(message, userId) === emoji;
  return {
    emoji: removing ? null : emoji,
    reactions: removing
      ? others
      : [
          ...others,
          { emoji, reactorUserId: userId, reactorContactId: null, reactorMobileNumber: null },
        ],
  };
}

// The forward screen's messages, handed over by the chat (too long for route params).
let pendingForward: { conversationId: string; messages: ChatMessage[] } | null = null;
export function setForward(value: typeof pendingForward) {
  pendingForward = value;
}
export const getForward = () => pendingForward;
