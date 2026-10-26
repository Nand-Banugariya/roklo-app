import type { Conversation } from "../types";

// Same tones accepted by the web app's POST /w/:workspaceId/ai-rephrase.
export const REPHRASE_TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "empathetic", label: "Empathetic" },
] as const;

export type RephraseTone = (typeof REPHRASE_TONES)[number]["value"];

/** Replies send literal text, so resolve any variables the AI adds before review. */
export function fillRephraseVariables(text: string, conversation: Pick<Conversation, "name" | "mobileNumber" | "isGroup">, now = new Date()) {
  const name = conversation.isGroup ? "everyone" : conversation.name.trim();
  const values: Record<string, string> = {
    name,
    firstName: name.split(/\s+/)[0],
    mobile: conversation.mobileNumber ?? "",
    date: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
  };
  return text.replace(/\{\{([^}|]+?)(?:\|([^}]*))?\}\}/g, (_match, rawKey: string, fallback?: string) => {
    const key = rawKey.trim();
    return values[key] || fallback || `[${key}]`;
  });
}
