import {
  Ban,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  CircleX,
  Clock3,
  FilePen,
  Pause,
  Send,
  type LucideIcon,
} from "lucide-react-native";
import type { BroadcastFilter, BroadcastRunStatus, BroadcastStatus } from "./types";

export interface StatusStyle {
  label: string;
  icon: LucideIcon;
  /** Pill and tile background, and the status in its colour. */
  pill: string;
  text: string;
  /** The progress bar's sent part. */
  bar: string;
}

/**
 * The web app's status colours: green sending or done, a soft blue scheduled, amber paused or partly
 * sent, red failed, grey drafts.
 */
export const STATUS: Record<BroadcastStatus, StatusStyle> = {
  RUNNING: {
    label: "Sending",
    icon: Send,
    pill: "bg-success-bg",
    text: "text-success-fg",
    bar: "bg-brand-600",
  },
  SCHEDULED: {
    label: "Scheduled",
    icon: CalendarClock,
    pill: "bg-info-bg",
    text: "text-info-fg",
    bar: "bg-info-solid",
  },
  PAUSED: {
    label: "Paused",
    icon: Pause,
    pill: "bg-warning-tint",
    text: "text-warning-fg",
    bar: "bg-warning-solid",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCheck,
    pill: "bg-ink-100",
    text: "text-ink-700",
    bar: "bg-success-solid",
  },
  FAILED: {
    label: "Failed",
    icon: CircleX,
    pill: "bg-error-bg-2",
    text: "text-error-strong",
    bar: "bg-error-solid",
  },
  PARTIALLY_COMPLETED: {
    label: "Partly sent",
    icon: CircleAlert,
    pill: "bg-warning-pill-bg",
    text: "text-warning-pill-fg",
    bar: "bg-warning-solid",
  },
  DRAFT: {
    label: "Draft",
    icon: FilePen,
    pill: "bg-ink-100",
    text: "text-ink-600",
    bar: "bg-ink-300",
  },
};

/** A run's status in the same colours (`PENDING` is a send that hasn't started). */
export const RUN_STATUS: Record<BroadcastRunStatus, StatusStyle> = {
  PENDING: { ...STATUS.SCHEDULED, label: "Queued", icon: Clock3 },
  RUNNING: STATUS.RUNNING,
  PAUSED: STATUS.PAUSED,
  // A finished send is good news: green.
  COMPLETED: {
    ...STATUS.COMPLETED,
    pill: "bg-success-bg",
    text: "text-success-fg",
  },
  PARTIALLY_COMPLETED: STATUS.PARTIALLY_COMPLETED,
  // Its failed messages are the red part of the bar; what did go out stays neutral.
  FAILED: { ...STATUS.FAILED, bar: "bg-ink-400" },
  CANCELED: { ...STATUS.DRAFT, label: "Cancelled", icon: Ban },
};

/** The status chips, in the API's tier order. Failed covers partly sent broadcasts too. */
export const FILTERS: { value: BroadcastFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "RUNNING", label: "Sending" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PAUSED", label: "Paused" },
  { value: "DRAFT", label: "Drafts" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

/** While something is sending, the list re-reads this often for live progress. */
export const LIVE_REFRESH_MS = 10_000;

/**
 * Variables the API fills in per contact when it sends, as the web's "Add variable" menu groups them.
 * `name` inserts `{{name}}`.
 */
export const MESSAGE_VARIABLES = [
  { key: "name", label: "Contact Name", group: "Contact" },
  { key: "firstName", label: "First Name", group: "Contact" },
  { key: "mobile", label: "Mobile Number", group: "Contact" },
  { key: "email", label: "Email", group: "Contact" },
  { key: "date", label: "Current Date", group: "Date & Time" },
  { key: "time", label: "Current Time", group: "Date & Time" },
] as const;

/** Attachments, as the web's: at most this many files, each up to this size, of these types. */
export const MAX_ATTACHMENTS = 5;
export const ATTACHMENT_MAX_MB = 50;
/** The API's allowed types, by extension (what the web's picker matches on). */
export const ATTACHMENT_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "mp4",
  "3gp",
  "mp3",
  "ogg",
  "aac",
  "amr",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
];
/** The same types for the system file picker. */
export const ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/3gpp",
  "audio/mpeg",
  "audio/ogg",
  "audio/aac",
  "audio/amr",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/comma-separated-values",
  "text/plain",
];

/** "Analyze with AI": each spam-risk level's words and colours, as the web's. */
export const MESSAGE_RISK = {
  low: {
    label: "Low risk",
    text: "text-success-fg",
    bar: "bg-success-solid",
    track: "bg-brand-100",
  },
  medium: {
    label: "Medium risk",
    text: "text-warning-pill-fg",
    bar: "bg-warning-solid",
    track: "bg-warning-pill-bg",
  },
  high: {
    label: "High risk",
    text: "text-error-fg",
    bar: "bg-error-solid",
    track: "bg-error-bg-2",
  },
} as const;

/** The longest message a broadcast takes. */
export const BODY_MAX = 4096;
