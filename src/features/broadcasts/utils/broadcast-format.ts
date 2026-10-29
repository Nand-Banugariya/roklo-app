import type { Broadcast, BroadcastRepeat, BroadcastRun, BroadcastStatus } from "../types";

// Ported from the web app's broadcast helpers. Dates read in the phone's own time zone.

const COUNT = new Intl.NumberFormat("en-IN");
export const formatCount = (n: number) => COUNT.format(n);
export const plural = (n: number, word: string, many = `${word}s`) =>
  `${COUNT.format(n)} ${n === 1 ? word : many}`;
/** Whole-number share, or null when there's nothing to divide by. */
export const ratio = (part: number, whole: number) =>
  whole > 0 ? Math.min(1, Math.max(0, part / whole)) : null;
export const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const parse = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};
/** yyyy-MM-dd in local time. */
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shiftDay = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** "Today, 17:00", "Tomorrow, 09:30", "Fri 9 Oct, 10:00" (`weekday`), "20 Sep 2025, 18:00". Empty for no date. */
export function formatWhen(
  iso: string | null | undefined,
  { weekday = false, now = new Date() }: { weekday?: boolean; now?: Date } = {},
) {
  const date = parse(iso);
  if (!date) return "";
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = dayKey(date);
  if (day === dayKey(now)) return `Today, ${time}`;
  if (day === dayKey(shiftDay(now, 1))) return `Tomorrow, ${time}`;
  if (day === dayKey(shiftDay(now, -1))) return `Yesterday, ${time}`;
  const label = [
    weekday ? WEEKDAY[date.getDay()] : null,
    date.getDate(),
    MONTH[date.getMonth()],
    date.getFullYear() === now.getFullYear() ? null : date.getFullYear(),
  ]
    .filter((part) => part !== null)
    .join(" ");
  return `${label}, ${time}`;
}

const WEEK_DAYS = [
  ["MONDAY", "Mon", "Monday"],
  ["TUESDAY", "Tue", "Tuesday"],
  ["WEDNESDAY", "Wed", "Wednesday"],
  ["THURSDAY", "Thu", "Thursday"],
  ["FRIDAY", "Fri", "Friday"],
  ["SATURDAY", "Sat", "Saturday"],
  ["SUNDAY", "Sun", "Sunday"],
] as const;
const ordinal = (n: number) => {
  const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(n) as
    "one" | "two" | "few" | "other";
  return `${n}${{ one: "st", two: "nd", few: "rd", other: "th" }[rule] ?? "th"}`;
};

/** "Every Friday", "Every 2 weeks on Mon, Thu", "Monthly on the 2nd", "Every day". Empty when it doesn't repeat. */
export function repeatLabel(repeat: BroadcastRepeat, start: string | null) {
  const every = Math.max(1, repeat.interval ?? 1);
  switch (repeat.type) {
    case "DAILY":
      return every === 1 ? "Every day" : `Every ${every} days`;
    case "WEEKLY": {
      const days = WEEK_DAYS.filter(([value]) => repeat.weekDays.includes(value));
      const names = days.length === 1 ? days[0][2] : days.map(([, short]) => short).join(", ");
      if (every === 1) return days.length ? `Every ${names}` : "Every week";
      return days.length ? `Every ${every} weeks on ${names}` : `Every ${every} weeks`;
    }
    case "MONTHLY": {
      const date = parse(start);
      const on = date ? ` on the ${ordinal(date.getDate())}` : "";
      return every === 1 ? `Monthly${on}` : `Every ${every} months${on}`;
    }
    default:
      return "";
  }
}

/** A repeating broadcast whose end date is behind it: it mustn't resume (sending on the end date is fine). */
export function isRepeatEnded(repeat: BroadcastRepeat, now = new Date()) {
  if (repeat.type === "NONE" || !repeat.until) return false;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(repeat.until)
    ? repeat.until
    : parse(repeat.until)
      ? dayKey(parse(repeat.until)!)
      : null;
  return end !== null && end < dayKey(now);
}

/** It has finished: nothing is queued any more, whatever it managed to send. */
export const isFinished = (status: BroadcastStatus) =>
  status === "COMPLETED" || status === "FAILED" || status === "PARTIALLY_COMPLETED";
/** Every message planned across its runs, or its audience before the first one starts. */
export const plannedOf = (broadcast: Pick<Broadcast, "targets" | "totalRecipients">) =>
  broadcast.targets || broadcast.totalRecipients;

/** Its card's line after the status: what matters most in that status. */
export function rowDetail(broadcast: Broadcast, now = new Date()) {
  switch (broadcast.status) {
    case "RUNNING":
      return `${formatCount(broadcast.sent)} / ${formatCount(plannedOf(broadcast))} sent`;
    case "PAUSED":
      return broadcast.sent > 0
        ? `${formatCount(broadcast.sent)} / ${formatCount(plannedOf(broadcast))} sent`
        : `${formatCount(broadcast.totalRecipients)} queued`;
    case "SCHEDULED": {
      const next = formatWhen(broadcast.nextScheduledAt, { now });
      return next ? `Next ${next}` : "";
    }
    case "DRAFT":
      return "Not scheduled yet";
    default:
      return formatWhen(broadcast.lastSentAt, { now });
  }
}

const PAUSE_REASONS: Record<string, string> = {
  ghost_ratio: "Too many undelivered",
  reply_rate: "Reply rate too low",
  circuit_breaker: "Too many failed",
  session_disconnected: "Number disconnected",
  template_archived: "Template archived",
};
/** The short reason for a paused run; "Paused by your team" when the API gave none. */
export function pauseReasonLabel(run: Pick<BroadcastRun, "pauseReason" | "ghostFlagged">) {
  const reason = run.pauseReason ?? (run.ghostFlagged ? "ghost_ratio" : null);
  return reason ? (PAUSE_REASONS[reason] ?? "Paused") : "Paused by your team";
}

/** "35 min", "2h 5m", "1 day 3h". */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ${hours % 24}h`;
}
/** How long a run took (start to finish, or to now while it goes); null before it starts. */
export function runDuration(
  run: Pick<BroadcastRun, "startedAt" | "completedAt">,
  now = Date.now(),
) {
  const start = parse(run.startedAt)?.getTime();
  if (start === undefined) return null;
  const end = parse(run.completedAt)?.getTime() ?? now;
  const ms = Math.max(0, end - start);
  return ms < 60_000 ? "Under a minute" : formatMinutes(Math.floor(ms / 60_000));
}

/** The API's reply-rate check: once a run has sent 25, under 3% replies pauses it; under 5% is close. */
export const REPLY_RATE = { minSent: 25, floor: 0.03, healthy: 0.05 } as const;
export const replyRate = (run: Pick<BroadcastRun, "sent" | "replied">) =>
  run.sent >= REPLY_RATE.minSent ? run.replied / run.sent : null;

/** The time zone's short name ("IST"), as the web labels its times; the zone's id if there's none. */
export function zoneLabel(timeZone: string, date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat("en-IN", { timeZone, timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    return name ?? timeZone;
  } catch {
    return timeZone;
  }
}
