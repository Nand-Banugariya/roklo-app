const DAY = 86_400_000;

function parse(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function daysAgo(date: Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY);
}

export function clockTime(value: string | null | undefined) {
  const date = parse(value);
  return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Full short date: 7 Oct 2026. */
export function shortDate(value: string | null | undefined) {
  const date = parse(value);
  return date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** Conversation list stamp: time today, then Yesterday, weekday within a week, then a short date. */
export function chatTime(value: string | null | undefined, now = new Date()) {
  const date = parse(value);
  if (!date) return "";
  const ago = daysAgo(date, now);
  if (ago <= 0) return clockTime(value);
  if (ago === 1) return "Yesterday";
  if (ago < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], date.getFullYear() === now.getFullYear()
    ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/** Thread separator label: Today, Yesterday, weekday within a week, then a full date. */
export function dayLabel(value: string | null | undefined, now = new Date()) {
  const date = parse(value);
  if (!date) return "";
  const ago = daysAgo(date, now);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], date.getFullYear() === now.getFullYear()
    ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
}

export function sameDay(a: string | null | undefined, b: string | null | undefined) {
  const left = parse(a);
  const right = parse(b);
  return !!left && !!right && startOfDay(left) === startOfDay(right);
}

export function minutesApart(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;
}
