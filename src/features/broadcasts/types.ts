import type { OutgoingFile } from "@/features/messaging/types";

/**
 * A broadcast's state (the API's `CampaignStatus`). RUNNING is "Sending" in the UI. FAILED and
 * PARTIALLY_COMPLETED only exist on older broadcasts: newer ones end COMPLETED with their failures counted.
 */
export type BroadcastStatus =
  "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "PARTIALLY_COMPLETED";
export type RepeatType = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
export type SendMode = "NOW" | "LATER" | "RECURRING";
export type WeekDay =
  "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface BroadcastRepeat {
  type: RepeatType;
  /** Every N days / weeks / months; null when not repeating. */
  interval: number | null;
  weekDays: WeekDay[];
  /** Last day it repeats; null for no end. */
  until: string | null;
}

export interface BroadcastTag {
  id: string;
  name: string;
  color: string | null;
}

/** A row of the broadcasts list, as the web app maps it. */
export interface Broadcast {
  id: string;
  name: string;
  status: BroadcastStatus;
  sendMode: SendMode;
  templateName: string | null;
  /** Recipients the audience expands to (a Roklo group counts its contacts). */
  totalRecipients: number;
  tags: BroadcastTag[];
  /** Messages of every run so far. */
  sent: number;
  delivered: number;
  replied: number;
  /** Messages that couldn't be sent, over every finished run. */
  failed: number;
  /** Messages planned across every run (0 until the first run starts). */
  targets: number;
  /** Internal name of the number that sent most in the latest run. */
  sessionName: string | null;
  nextScheduledAt: string | null;
  scheduledAt: string | null;
  /** When it last went out, as far as the list knows. */
  lastSentAt: string | null;
  repeat: BroadcastRepeat;
  timezone: string;
  /** Set while sending waits for a number's daily limit to reset. */
  stuckDueToCapAt: string | null;
  createdAt: string;
}

export interface BroadcastPage {
  broadcasts: Broadcast[];
  total: number;
  hasMore: boolean;
}

export interface BroadcastCounts {
  total: number;
  counts: Partial<Record<BroadcastStatus, number>>;
  /** Broadcasts with failed messages, in any status (the "Failed" filter); absent from older APIs. */
  failures?: number;
}

/** The list's status filter: everything, or one status (Failed covers partly sent ones too). */
export type BroadcastFilter =
  "ALL" | "RUNNING" | "SCHEDULED" | "PAUSED" | "DRAFT" | "COMPLETED" | "FAILED";

/** A run's state: one send of a broadcast (a repeating broadcast has one per occurrence). */
export type BroadcastRunStatus =
  "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED" | "CANCELED";

export interface BroadcastRun {
  id: string;
  broadcastId: string;
  /** 1 for the first send, counting up. */
  runNumber: number;
  status: BroadcastRunStatus;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  /** Only a single run's read has these; null in the runs list. */
  delivered: number | null;
  read: number | null;
  replied: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  /** The API's reason, or null for a pause from the team. */
  pauseReason: string | null;
  /** Too many messages reached WhatsApp but never a phone. */
  ghostFlagged: boolean;
  ghostPausedUntil: string | null;
  stuckDueToCapAt: string | null;
}

export interface BroadcastRunPage {
  runs: BroadcastRun[];
  total: number;
}

/** A group the audience picker offers (GET /campaigns/available-groups). */
export interface AvailableGroup {
  id: string;
  name: string;
  type: "WA" | "ROKLO";
  memberCount: number;
  /** Announcement-only WhatsApp group: only admins can post. */
  isAnnounce: boolean;
  /** One of the given numbers is an admin of it. */
  isAdminSession: boolean;
}

/** Who a new broadcast goes to. */
export interface NewAudience {
  rokloGroups: { id: string; name: string; memberCount: number }[];
  waGroups: { id: string; name: string; memberCount: number }[];
  contacts: { id: string; name: string; phone: string }[];
}

/** A new broadcast, as the mobile builder makes it (no template: that stays on the web). */
export interface NewBroadcastInput {
  name: string;
  /** Broadcast tags (up to 5). */
  tagIds: string[];
  /** Who in the workspace sees it; TEAM is limited to `teamIds` and `memberIds`. */
  visibility: "EVERYONE" | "TEAM" | "ME_ONLY";
  teamIds?: string[];
  memberIds?: string[];
  audience: NewAudience;
  content: string;
  /** New attachments, uploaded with the message (saved ones count toward the 5 too). */
  files?: OutgoingFile[];
  /** A reopened draft's saved files that stay. */
  keepKeys?: string[];
  /** Kept from a draft made on the web: its template and message versions (mobile doesn't edit them). */
  templateId?: string | null;
  variations?: string[];
  /** The numbers it sends from. */
  sessionIds: string[];
  when: "now" | "later" | "repeat";
  /** ISO time of the (first) send. "Now" is a few seconds ahead, as the web sends it. */
  scheduledAt?: string;
  /** Only for "repeat". */
  repeat?: {
    type: Exclude<RepeatType, "NONE">;
    interval: number;
    weekDays: WeekDay[];
    until: string | null;
  };
  /** A break after this many messages. */
  batchSize: number;
  timezone: string;
}

/** A file already saved on a broadcast: its storage key, and the name it shows. */
export interface SavedFile {
  key: string;
  name: string;
}

/** A saved draft, as the builder fills it back in (GET /campaigns/:id with its targets). */
export interface BroadcastDraft {
  id: string;
  name: string;
  status: BroadcastStatus;
  sendMode: SendMode;
  templateId: string | null;
  content: string;
  attachments: SavedFile[];
  visibility: "EVERYONE" | "TEAM" | "ME_ONLY";
  teamIds: string[];
  memberIds: string[];
  tagIds: string[];
  sessionIds: string[];
  variations: string[];
  audience: NewAudience;
  scheduledAt: string | null;
  nextScheduledAt: string | null;
  timezone: string;
  repeat: BroadcastRepeat;
  batchSize: number;
}

/** Contacts the API blocked because they aren't saved on the sending WhatsApp account (E09). */
export interface UnsavedContact {
  id: string;
  name: string;
  phone: string;
}

/** Create: done, a recoverable E09 block (send anyway), or an error. */
export type CreateResult =
  | { ok: true; id: string; warnings: string[] }
  | { ok: false; unsavedContacts: UnsavedContact[]; message: string }
  | { ok: false; error: string };

/** What the detail screen reads of one broadcast (GET /campaigns/:id without its audience). */
export interface BroadcastSummary {
  id: string;
  name: string;
  status: BroadcastStatus;
  scheduledAt: string | null;
  nextScheduledAt: string | null;
  timezone: string;
  repeat: BroadcastRepeat;
  templateName: string | null;
  totalRecipients: number;
  failed: number;
  stuckDueToCapAt: string | null;
  /** Sends to WhatsApp groups, which have no delivery or read receipts. */
  hasGroupTargets: boolean;
  createdAt: string;
}
