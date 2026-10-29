import type { ApiResult } from "@/services/api/create-client";
import type { Conversation, MentionedParticipant, MessagePage } from "../types";

// Match whole WhatsApp ids at a word boundary. URLs and code remain literal.
const MENTION =
  /```[\s\S]+?```|https?:\/\/[^\s<]+|(^|[^\p{L}\p{N}_@])@(\d{5,})(?:@(?:c\.us|s\.whatsapp\.net|lid))?(?![\p{L}\p{N}_@])/gu;

export interface MentionRun {
  text: string;
  mention: boolean;
}

export function hasNumericMention(text: string) {
  return [...text.matchAll(MENTION)].some((match) => !!match[2]);
}

/** Resolve only identities supplied for this message; never guess another group's member. */
export function mentionRuns(text: string, participants: MentionedParticipant[] = []): MentionRun[] {
  if (!participants.length || !text.includes("@")) return [{ text, mention: false }];
  const names = new Map<string, string>();
  for (const participant of participants) {
    const id = participant.number.replace(/^@/, "").split("@")[0].split(":")[0];
    const name = participant.name?.trim().replace(/^@+/, "");
    const phone =
      participant.mobileNumber && !participant.mobileNumber.endsWith("@lid")
        ? participant.mobileNumber.split("@")[0].replace(/\D/g, "")
        : "";
    const label = name || (phone ? `+${phone}` : "");
    if (label) names.set(id, label);
  }
  const runs: MentionRun[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const name = names.get(match[2]);
    if (!match[2] || !name) continue;
    const start = match.index + (match[1]?.length ?? 0);
    if (start > last) runs.push({ text: text.slice(last, start), mention: false });
    runs.push({ text: `@${name}`, mention: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), mention: false });
  return runs;
}

export function resolveMentionText(text: string, participants?: MentionedParticipant[]) {
  return mentionRuns(text, participants)
    .map((run) => run.text)
    .join("");
}

const fingerprint = (row: Conversation) => `${row.lastMessageAt}\n${row.lastMessagePreview}`;

/** The list API supplies only raw preview text. Read resolved mentions only for affected group rows. */
export function createPreviewMentionResolver(
  read: (id: string, signal: AbortSignal) => Promise<ApiResult<MessagePage>>,
) {
  const cache = new Map<
    string,
    { key: string; participants: MentionedParticipant[]; checkedAt: number }
  >();
  const needed = (row: Conversation) =>
    row.isGroup && !!row.lastMessagePreview && hasNumericMention(row.lastMessagePreview);
  function cached(row: Conversation): Conversation {
    const entry = cache.get(row.id);
    return needed(row) && entry?.key === fingerprint(row)
      ? { ...row, lastMessageMentionedParticipants: entry.participants }
      : row;
  }
  async function resolve(
    rows: Conversation[],
    signal: AbortSignal,
    onResolved: (row: Conversation) => void,
  ) {
    const queue = rows.filter((row) => {
      const entry = cache.get(row.id);
      return (
        needed(row) &&
        (!entry || entry.key !== fingerprint(row) || Date.now() - entry.checkedAt > 30_000)
      );
    });
    let next = 0;
    async function worker() {
      while (next < queue.length && !signal.aborted) {
        const row = queue[next++];
        try {
          const result = await read(row.id, signal);
          if (signal.aborted) return;
          if (!result.ok) continue;
          // A private note never changes lastMessagePreview. Match the actual reply,
          // including a server-truncated preview, rather than trusting the last row.
          const preview = row.lastMessagePreview!.trim();
          const latest = result.data.data
            .slice()
            .reverse()
            .find(
              (message) =>
                message.type === "REPLY" &&
                !message.isRevoked &&
                message.body?.trim().startsWith(preview),
            );
          const participants = latest?.mentionedParticipants ?? [];
          cache.set(row.id, { key: fingerprint(row), participants, checkedAt: Date.now() });
          if (cache.size > 100) cache.delete(cache.keys().next().value!);
          onResolved({ ...row, lastMessageMentionedParticipants: participants });
        } catch {
          // Name resolution must never stop the inbox from loading.
        }
      }
    }
    await Promise.all([worker(), worker()]);
  }
  return { cached, resolve };
}
