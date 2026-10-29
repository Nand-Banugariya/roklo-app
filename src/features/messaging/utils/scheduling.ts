export const SCHEDULE_MIN_LEAD_MS = 60_000;
export const SCHEDULE_MAX_DAYS = 30;

export function scheduleDays(now = new Date()) {
  return Array.from(
    { length: SCHEDULE_MAX_DAYS + 1 },
    (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + index),
  );
}

export function defaultSchedule(now = new Date()) {
  const date = new Date(now.getTime() + 60 * 60_000);
  date.setSeconds(0, 0);
  return date;
}

/** Local wall time; reject a clock time skipped by daylight saving. */
export function scheduleDate(day: Date, hour: number, minute: number, period: "AM" | "PM") {
  const hours = (hour % 12) + (period === "PM" ? 12 : 0);
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minute);
  return date.getHours() === hours && date.getMinutes() === minute ? date : null;
}

export function scheduleError(date: Date | null, now = new Date()): string | null {
  if (!date || !Number.isFinite(date.getTime())) return "Choose a valid time on this date.";
  if (date.getTime() < now.getTime() + SCHEDULE_MIN_LEAD_MS)
    return "Choose a time at least one minute from now.";
  if (date.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000)
    return "Choose a time within the next 30 days.";
  return null;
}

/** The inbox API expects an explicit offset, including +00:00 for UTC. */
export function scheduleTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const zone = `${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${zone}`;
}

export function formatSchedule(date: string | Date) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
