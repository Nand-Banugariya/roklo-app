import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useRealtimeEvent } from "../hooks/use-realtime-event";
import type {
  AgentTypingEvent,
  Conversation,
  MessageNewEvent,
  PresenceUpdateEvent,
} from "../types";
import { useMessaging } from "./messaging-context";

// The web app's timings (lib/inbox/constants.ts).
/** A teammate's "typing" shows this long after their last heartbeat (a closed app never sends "paused"). */
const TEAMMATE_TYPING_TTL_MS = 8_000;
/** A customer's "typing"/"recording" shows this long without an update (WhatsApp may never send "paused"). */
const CUSTOMER_TYPING_TTL_MS = 15_000;

export type CustomerActivity = "typing" | "recording";
/** Who's typing in one chat. */
export interface ChatTyping {
  customer: CustomerActivity | null;
  /** Teammates typing a reply, in the order they started; null for one without a name. */
  teammates: (string | null)[];
}
type TypingKey = Pick<Conversation, "id" | "sessionId" | "isGroup" | "mobileNumber">;
interface State {
  /** By presence key (number + phone digits): presence events carry no conversation id. */
  customers: ReadonlyMap<string, { kind: CustomerActivity; at: number }>;
  /** By conversation id, then user id. */
  teammates: ReadonlyMap<string, ReadonlyMap<string, string | null>>;
  /** When a message last arrived in a chat: it ends the customer's typing ("paused" may never come). */
  messagedAt: ReadonlyMap<string, number>;
}

/** The digits of a phone number or a WhatsApp id (`919499512283@c.us`). */
const digitsOf = (value: string | null | undefined) =>
  (value ?? "").split("@")[0].replace(/\D/g, "");
const presenceKey = (sessionId: string, phone: string) => `${sessionId}|${phone}`;
function conversationKey(chat: TypingKey) {
  const phone = chat.isGroup ? "" : digitsOf(chat.mobileNumber);
  return phone ? presenceKey(chat.sessionId, phone) : null;
}
function withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V | undefined) {
  const next = new Map(map);
  if (value === undefined) next.delete(key);
  else next.set(key, value);
  return next;
}

const TypingContext = createContext<((chat: TypingKey) => ChatTyping | null) | null>(null);

/**
 * Live typing across the inbox, for the chat list and the open chat (the web app's useInboxTyping):
 * teammates from `inbox.agent.typing` (never your own), customers of 1:1 chats from
 * `inbox.presence.update`, each expiring when no update comes. Presence only arrives for chats whose
 * messages were loaded.
 */
export function TypingProvider({ children }: PropsWithChildren) {
  const { userId } = useMessaging();
  const [state, setState] = useState<State>({
    customers: new Map(),
    teammates: new Map(),
    messagedAt: new Map(),
  });
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** (Re)starts or cancels the expiry timer `id`. */
  function expire(id: string, run: (() => void) | null, ms = 0) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    if (!run) return;
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        run();
      }, ms),
    );
  }
  function setTeammate(conversationId: string, id: string, name: string | null | undefined) {
    setState((current) => {
      const names = current.teammates.get(conversationId) ?? new Map<string, string | null>();
      if (name === undefined ? !names.has(id) : names.get(id) === name) return current;
      const next = withEntry(names, id, name);
      return {
        ...current,
        teammates: withEntry(current.teammates, conversationId, next.size ? next : undefined),
      };
    });
  }
  function setCustomer(key: string, kind: CustomerActivity | null) {
    setState((current) =>
      !kind && !current.customers.has(key)
        ? current
        : {
            ...current,
            customers: withEntry(
              current.customers,
              key,
              kind ? { kind, at: Date.now() } : undefined,
            ),
          },
    );
  }

  useRealtimeEvent<AgentTypingEvent>("inbox.agent.typing", (event) => {
    if (!event?.conversationId || !event.userId || event.userId === userId) return;
    const timer = `t|${event.conversationId}|${event.userId}`;
    if (event.state !== "typing") {
      expire(timer, null);
      setTeammate(event.conversationId, event.userId, undefined);
      return;
    }
    expire(
      timer,
      () => setTeammate(event.conversationId, event.userId, undefined),
      TEAMMATE_TYPING_TTL_MS,
    );
    setTeammate(event.conversationId, event.userId, event.userName?.trim() || null);
  });
  useRealtimeEvent<PresenceUpdateEvent>("inbox.presence.update", (event) => {
    const phone = digitsOf(event?.wahaChatId);
    if (!event?.sessionId || !phone || event.wahaChatId.endsWith("@g.us")) return;
    const presences = event.presences ?? [];
    const status = (
      presences.find((presence) => digitsOf(presence.participant) === phone) ?? presences[0]
    )?.status;
    if (!status) return;
    const key = presenceKey(event.sessionId, phone);
    const timer = `c|${key}`;
    if (status !== "typing" && status !== "recording") {
      expire(timer, null);
      setCustomer(key, null);
      return;
    }
    expire(timer, () => setCustomer(key, null), CUSTOMER_TYPING_TTL_MS);
    setCustomer(key, status);
  });
  useRealtimeEvent<MessageNewEvent>("inbox.message.new", (event) => {
    if (!event?.conversationId) return;
    setState((current) =>
      current.customers.size
        ? {
            ...current,
            messagedAt: withEntry(current.messagedAt, event.conversationId, Date.now()),
          }
        : current,
    );
  });
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const typingFor = useCallback(
    (chat: TypingKey): ChatTyping | null => {
      const key = conversationKey(chat);
      const entry = key ? state.customers.get(key) : undefined;
      const customer = entry && entry.at > (state.messagedAt.get(chat.id) ?? 0) ? entry.kind : null;
      const names = state.teammates.get(chat.id);
      const teammates = names ? [...names.values()] : [];
      return customer || teammates.length ? { customer, teammates } : null;
    },
    [state],
  );
  return <TypingContext.Provider value={typingFor}>{children}</TypingContext.Provider>;
}

/** Who's typing in a chat; null when nobody is (or before the chat is known). */
export function useChatTyping(chat: TypingKey | null | undefined) {
  const typingFor = useContext(TypingContext);
  if (!typingFor) throw new Error("useChatTyping requires TypingProvider.");
  return chat ? typingFor(chat) : null;
}

/** A first word for short labels; a number (or a name with no letters) stays whole. */
const shortName = (name: string) => (/\p{L}/u.test(name) ? name.trim().split(/\s+/)[0] : name);

/**
 * A chat's live line, as WhatsApp words it: the customer is "typing…" / "recording audio…";
 * teammates are named: "Priya is typing…", "Priya and Ravi are typing…", "3 teammates are typing…".
 */
export function typingLabel(typing: ChatTyping | null) {
  if (!typing) return null;
  const parts: string[] = [];
  if (typing.customer) parts.push(typing.customer === "recording" ? "recording audio" : "typing");
  const names = typing.teammates.map((name) => (name ? shortName(name) : "A teammate"));
  if (names.length === 1) parts.push(`${names[0]} is typing`);
  else if (names.length === 2) parts.push(`${names[0]} and ${names[1]} are typing`);
  else if (names.length > 2) parts.push(`${names.length} teammates are typing`);
  return parts.length ? `${parts.join(" · ")}…` : null;
}
