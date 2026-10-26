import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";
import type { createMessagingApi } from "../services/messaging-api";
import type { WhatsAppNumber } from "../types";

// The messaging context on its own, so hooks the provider renders (typing, live events, the message
// store sync) can read it without importing the provider: that import loop made Metro warn.

export type MessagingContextValue = {
  api: ReturnType<typeof createMessagingApi>;
  numbers: WhatsAppNumber[];
  activeNumber: WhatsAppNumber | null;
  loading: boolean;
  error: string | null;
  refreshNumbers: () => Promise<WhatsAppNumber[]>;
  selectNumber: (id: string) => void;
  /** The workspace socket; null until created (or with no workspace). */
  socket: Socket | null;
  /** In its rooms: live events are arriving, so polling can slow down. */
  live: boolean;
  userId: string;
};
export const MessagingContext = createContext<MessagingContextValue | null>(null);

export function useMessaging() {
  const value = useContext(MessagingContext);
  if (!value) throw new Error("useMessaging requires MessagingProvider.");
  return value;
}
