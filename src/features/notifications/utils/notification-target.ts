export interface NotificationTarget {
  workspaceId: string;
  conversationId: string;
  messageId: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function identifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    value.trim() === value &&
    !/[\s/\\?#\u0000-\u001f]/.test(value)
  );
}

function supportedEvent(value: unknown): boolean {
  return value === undefined || value === "inbox.mention" || value === "inbox.message.received";
}

/** Only app identifiers are accepted; never navigate to a URL supplied by a push. */
export function notificationTarget(data: unknown): NotificationTarget | null {
  const outer = record(data);
  if (!outer || !supportedEvent(outer.event)) return null;
  const payload = record(outer.payload) ?? outer;
  if (!supportedEvent(payload.event)) return null;
  if (outer.event !== undefined && payload.event !== undefined && outer.event !== payload.event)
    return null;
  const { workspaceId, conversationId, messageId } = payload;
  return identifier(workspaceId) && identifier(conversationId) && identifier(messageId)
    ? { workspaceId, conversationId, messageId }
    : null;
}
