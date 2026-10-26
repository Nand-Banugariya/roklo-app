import type { ApiResult, createApiClient, RequestOptions } from "@/services/api/create-client";
import type { ChatFilter, ChatMessage, Conversation, ConversationPage, MessagePage, ForwardResult, NumberVisibility, OutgoingFile, TypingState, WhatsAppNumber } from "../types";
import type { RephraseTone } from "../utils/ai-rephrase";

const categories: Record<ChatFilter, string> = {
  all: "your-inbox", unread: "unread", groups: "group-chat", waiting: "longest-waiting",
};

export function createMessagingApi(request: ReturnType<typeof createApiClient>, workspaceId: string) {
  const workspace = <T>(path: string, options?: RequestOptions): Promise<ApiResult<T>> =>
    workspaceId ? request<T>(`/w/${encodeURIComponent(workspaceId)}${path}`, options)
      : Promise.resolve({ ok: false, reason: "failed", status: 0, message: "Choose a workspace first." });
  const inbox = <T>(path: string, options?: RequestOptions) =>
    workspace<T>(`/inbox${path}`, { ...options, envelope: false });
  return {
    /** Rewrites a draft for review; this endpoint never sends a WhatsApp message. */
    rephrase: async (content: string, signal?: AbortSignal, tone?: RephraseTone): Promise<ApiResult<string>> => {
      const result = await workspace<{ rephrasedContent?: unknown } | null>("/ai-rephrase", {
        method: "POST", body: tone ? { content, tone } : { content }, signal,
      });
      if (!result.ok) return result;
      const text = result.data?.rephrasedContent;
      return typeof text === "string" && text.trim()
        ? { ...result, data: text }
        : { ok: false, reason: "failed", status: 200, message: "Couldn't rephrase this message. Try again." };
    },
    numbers: (offset = 0, signal?: AbortSignal) => workspace<{ sessions: WhatsAppNumber[] }>(
      `/whatsapp/sessions?limit=50&offset=${offset}`, { signal }),
    addNumber: () => workspace<WhatsAppNumber>("/whatsapp/sessions", { method: "POST", body: {} }),
    pairingCode: (id: string, phoneNumber: string) => workspace<{ code: string }>(
      `/whatsapp/sessions/${encodeURIComponent(id)}/pairing-code`, { method: "POST", body: { phoneNumber } }),
    renameNumber: (id: string, displayName: string) => workspace<WhatsAppNumber>(
      `/whatsapp/sessions/${encodeURIComponent(id)}`, { method: "PATCH", body: { displayName } }),
    /** TEAM replaces the number's grants with these teams and people. */
    setVisibility: (id: string, visibility: NumberVisibility, targets?: { teamIds: string[]; memberIds: string[] }) => workspace<WhatsAppNumber>(
      `/whatsapp/sessions/${encodeURIComponent(id)}`, { method: "PATCH", body: visibility === "TEAM" && targets ? { visibility, ...targets } : { visibility } }),
    /** Unlinks the phone and removes the number from the workspace; its chats go with it. */
    removeNumber: (id: string) => workspace(`/whatsapp/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    teams: (signal?: AbortSignal) => workspace<{ id: string; name: string; _count?: { members?: number } }[]>("/teams", { signal }),
    members: (signal?: AbortSignal) => workspaceId ? request<{
      status: string; user: { id: string; name: string | null; email?: string | null; mobileNumber?: string | null } | null;
    }[]>(`/workspaces/${encodeURIComponent(workspaceId)}/members`, { signal })
      : Promise.resolve<ApiResult<never>>({ ok: false, reason: "failed", status: 0, message: "Choose a workspace first." }),
    conversations: (sessionId: string, filter: ChatFilter, search: string, page: number, signal?: AbortSignal) => {
      if (!sessionId) throw new Error("Choose a WhatsApp number before loading chats.");
      const params = new URLSearchParams({ sessionId, category: categories[filter], page: String(page), limit: "30" });
      if (search.trim()) params.set("search", search.trim());
      return inbox<ConversationPage>(`/conversations?${params}`, { signal });
    },
    conversation: (id: string, sessionId: string, signal?: AbortSignal) => inbox<ConversationPage>(
      `/conversations?${new URLSearchParams({ conversationId: id, sessionId })}`, { signal }),
    messages: (id: string, cursor: MessagePage["nextCursor"], signal?: AbortSignal, limit = 30) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) { params.set("beforeCreatedAt", cursor.createdAt); params.set("beforeId", cursor.id); }
      return inbox<MessagePage>(`/conversations/${encodeURIComponent(id)}/messages?${params}`, { signal });
    },
    /** A reply goes out on WhatsApp; a PRIVATE_NOTE stays with the team (text only). */
    send: (id: string, text: string, type: "REPLY" | "PRIVATE_NOTE" = "REPLY", files: OutgoingFile[] = [], replyToMessageId?: string) => {
      const body = new FormData();
      if (text) body.append("text", text);
      body.append("type", type);
      if (replyToMessageId) body.append("replyToMessageId", replyToMessageId);
      // Web passes the picked File; native passes { uri, name, type }, which React Native's FormData uploads.
      if (type === "REPLY") for (const file of files) body.append("files", (file.file ?? { uri: file.uri, name: file.name, type: file.mimeType }) as unknown as Blob);
      return inbox<ChatMessage>(`/conversations/${encodeURIComponent(id)}/messages`, { method: "POST", body });
    },
    /** The chat's WhatsApp profile picture (proxied and cached for an hour by the API); null url: none. */
    picture: (id: string) => inbox<{ url: string | null }>(`/conversations/${encodeURIComponent(id)}/picture`),
    /** Reacts on WhatsApp too. One reaction per teammate; the same emoji again (or null) removes it. */
    react: (id: string, messageId: string, emoji: string | null) => inbox<ChatMessage>(
      `/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/react`, { method: "POST", body: { emoji } }),
    /** Pins the message, or unpins it when it already is. A chat holds 3 pins at most; a 4th answers 400. */
    togglePin: (id: string, messageId: string) => inbox<ChatMessage>(
      `/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/pin`, { method: "PATCH" }),
    /** One message into up to 25 chats, each sent from its own number. The same forward within 30 s answers 409. */
    forward: (id: string, messageId: string, targetConversationIds: string[]) => inbox<ForwardResult>(
      `/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/forward`, { method: "POST", body: { targetConversationIds } }),
    /** One message: a socket event names it, and inbound media arrives again once downloaded. */
    message: (id: string, messageId: string, signal?: AbortSignal) => inbox<ChatMessage>(
      `/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`, { signal }),
    /** The customer sees WhatsApp's "typing…" and teammates see who's replying. Fire and forget. */
    setTyping: (id: string, state: TypingState) => {
      void inbox(`/conversations/${encodeURIComponent(id)}/typing`, { method: "POST", body: { state } }).catch(() => undefined);
    },
    markRead: (id: string) => inbox("/conversations/bulk", {
      method: "PATCH", body: { conversationIds: [id], action: "MARK_READ" },
    }),
    openContact: (sessionId: string, contactId: string) => inbox<Conversation>("/conversations/contact", {
      method: "POST", body: { sessionId, contactId },
    }),
    contacts: (search: string, offset: number, signal?: AbortSignal) => workspace<{
      contacts: { id: string; name: string | null; mobileNumber: string }[]; hasMore: boolean;
    }>(`/contacts/all?${new URLSearchParams({ search, offset: String(offset), limit: "30" })}`, { signal }),
  };
}
