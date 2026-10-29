import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface WhatsAppNumber {
  id: string;
  userId: string;
  sessionName: string;
  displayName: string | null;
  phoneNumber: string | null;
  status: string;
  isWhatsAppConnected: boolean;
  isActive: boolean;
  canSend?: boolean;
  chatCount?: number;
  /** Messages it may send per day, and how many it has sent today. */
  dailyCap?: number;
  dailySentCount?: number;
  lastConnectedAt?: string | null;
  /** Days old when first linked; null until asked ("How old is this number?"). */
  numberAgeAtConnection?: number | null;
  /** Who sees its chats; TEAM is limited to `accessGrants` (plus whoever added it and admins). */
  visibility?: NumberVisibility;
  accessGrants?: AccessGrant[];
}
export type NumberVisibility = "EVERYONE" | "TEAM" | "ME_ONLY";
/** One team or one person a TEAM number is shared with. */
export interface AccessGrant {
  id: string;
  team: { id: string; name: string } | null;
  user: { id: string; name: string | null } | null;
}
export interface AccessTarget {
  id: string;
  name: string;
  detail?: string;
}

export type ChatFilter = "all" | "unread" | "groups" | "waiting";
export interface Conversation {
  id: string;
  sessionId: string;
  name: string;
  mobileNumber: string | null;
  isGroup: boolean;
  isPinned: boolean;
  isMuted: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  /** Display-only names hydrated from the matching last reply's mentionedParticipants. */
  lastMessageMentionedParticipants?: MentionedParticipant[];
  canSendMessage: boolean;
  labels: { id: string; name: string; color: string | null }[];
  memberCount?: number | null;
  /** AWAITING_REPLY: the last message came in. */
  status?: "OPEN" | "AWAITING_REPLY" | "RESOLVED";
}
export interface ConversationPage {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
}
export interface ChatMessage {
  id: string;
  conversationId: string;
  type: "REPLY" | "PRIVATE_NOTE" | "SYSTEM";
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  files: string[];
  fileNames: string[];
  deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  failureReason: string | null;
  createdAt: string;
  isRevoked: boolean;
  /** Fields below are optional so older API replies and optimistic copies still fit. */
  contentType?: MessageContentType;
  richContent?: unknown;
  editedAt?: string | null;
  createdById?: string | null;
  /** The quoted message, as WhatsApp shows it above a reply. */
  replyToPreview?: {
    id: string;
    body: string | null;
    files?: string[];
    fileNames?: string[];
    contentType?: MessageContentType;
    mentionedParticipants?: MentionedParticipant[];
  } | null;
  /** WhatsApp group mentions, resolved by the API from that group's roster and contacts. */
  mentionedParticipants?: MentionedParticipant[];
  /** One per person: teammates by user id, customers by contact or number. */
  reactions?: {
    emoji: string;
    reactorContactId: string | null;
    reactorUserId: string | null;
    reactorMobileNumber: string | null;
  }[];
  /** Inbound group messages: who in the group wrote it. */
  sender?: { id: string | null; name: string | null; mobileNumber: string | null } | null;
  senderMobileNumber?: string | null;
  /** Pinned in this chat (Roklo only, not on WhatsApp); at most 3 per chat. */
  isPinned?: boolean;
  replyToMessageId?: string | null;
}
export interface MentionedParticipant {
  /** The exact digits in the body's @-mention (a phone number or WhatsApp LID). */
  number: string;
  name: string | null;
  mobileNumber: string | null;
}
/** A forward: straight into each chat (up to 3), or above that a paced broadcast the API set up. */
export type ForwardResult =
  | { mode: "DIRECT"; messages: ChatMessage[] }
  | { mode: "BROADCAST"; campaignId: string; warnings: string[] };
export type MessageContentType = "TEXT" | "CONTACT_CARD" | "POLL" | "VOICE";
export type DeliveryStatus = ChatMessage["deliveryStatus"];

// Socket payloads (roklo-api src/shared/types/socket-events.types.ts), as the web app reads them.
export interface MessageNewEvent {
  conversationId: string;
  messageId: string;
}
export interface MessageStatusEvent {
  conversationId: string;
  messageId: string;
  deliveryStatus: DeliveryStatus;
}
export interface ConversationUpdatedEvent {
  conversationId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadIncrement?: number;
  status: NonNullable<Conversation["status"]>;
}
/** 0 after mark read; above 0 after mark unread. Null ids: everything changed. */
export interface ReadStateEvent {
  conversationIds: string[] | null;
  unreadCount: number;
}
export type TypingState = "typing" | "paused";
/** A teammate started or stopped typing a reply (their own sockets get it too). */
export interface AgentTypingEvent {
  conversationId: string;
  userId: string;
  userName: string | null;
  state: TypingState;
}
/** What a 1:1 chat's customer is doing. No conversation id: match by session and the digits of `wahaChatId`. */
export interface PresenceUpdateEvent {
  sessionId: string;
  wahaChatId: string;
  presences: {
    participant: string;
    status: "online" | "offline" | "typing" | "recording" | "paused";
    lastSeen: number | null;
  }[];
}
/** POST /ai-message-score: a message's spam risk, 0–100. */
export interface MessageRiskScore {
  score: number;
  level: "low" | "medium" | "high";
  shouldBlock: boolean;
}
/** A file picked in the composer; `file` is set on web only. */
export interface OutgoingFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  file?: File;
}
export type ScheduledMessageStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
export interface ScheduledMessage {
  id: string;
  conversationId: string;
  status: ScheduledMessageStatus;
  scheduledAt: string;
  timezone: string;
  body: string | null;
  files: string[];
  fileNames: string[];
  contentType: MessageContentType;
  failureReason: string | null;
  canManage: boolean;
}
export interface ScheduledMessagePage {
  data: ScheduledMessage[];
  total: number;
  page: number;
  limit: number;
}
export interface ScheduledUpdatedEvent {
  conversationId: string;
  scheduledMessageId: string;
  status: ScheduledMessageStatus;
}
export interface MessagePage {
  data: ChatMessage[];
  hasMore: boolean;
  nextCursor: { createdAt: string; id: string } | null;
  backfilling: boolean;
}
export const isConnected = (number: WhatsAppNumber) =>
  ["WORKING", "CONNECTED"].includes(number.status);
export type ConnectionState = "connected" | "connecting" | "disconnected" | "unlinked";
export function connectionState(number: WhatsAppNumber): ConnectionState {
  if (isConnected(number)) return "connected";
  if (number.status === "STARTING") return "connecting";
  return number.phoneNumber ? "disconnected" : "unlinked";
}
/** International grouping (+91 98765 43210); falls back to plain E.164 when the number can't be parsed. */
function formatNumber(phoneNumber: string) {
  const e164 = `+${phoneNumber.replace(/^\+/, "")}`;
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.isValid() ? parsed.formatInternational() : e164;
}
export const numberName = (number: WhatsAppNumber) =>
  number.displayName || (number.phoneNumber ? formatNumber(number.phoneNumber) : "WhatsApp number");
export const numberPhone = (number: Pick<WhatsAppNumber, "phoneNumber">) =>
  number.phoneNumber ? formatNumber(number.phoneNumber) : "Not linked yet";
/** Who sees a number's chats, as the web contact panel words it: "Everyone", "Sales and Asha"… */
export function numberSharedWith(number: Pick<WhatsAppNumber, "visibility" | "accessGrants">) {
  if ((number.visibility ?? "EVERYONE") === "EVERYONE") return "Everyone";
  if (number.visibility === "ME_ONLY") return "Only its owner";
  const grants = number.accessGrants ?? [];
  const names = [
    ...grants.filter((grant) => grant.team).map((grant) => grant.team!.name),
    ...grants
      .filter((grant) => !grant.team && grant.user)
      .map((grant) => grant.user!.name || "Unnamed"),
  ];
  if (!names.length) return "Only admins";
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Never fall back to a combined inbox, including when a remembered number is removed. */
export function chooseNumber(numbers: WhatsAppNumber[], remembered: string | null) {
  return (
    numbers.find((number) => number.id === remembered) ??
    numbers.find(isConnected) ??
    numbers[0] ??
    null
  );
}
