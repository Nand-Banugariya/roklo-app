import { Check, Search, SendHorizontal, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { goBack, ScreenHeader } from "@/features/navigation/components/screen-header";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "../components/chat-avatar";
import { InboxState } from "../components/inbox-state";
import { useConversations } from "../hooks/use-conversations";
import { useMessaging } from "../providers/messaging-provider";
import type { Conversation } from "../types";
import { FORWARD_MAX_TARGETS, getForward, messageSummary } from "../utils/message-actions";
import { plainWhatsAppText } from "../utils/whatsapp-text";

/**
 * WhatsApp's "Forward to…", as a full screen: tick up to 25 chats on the active number, then send.
 * Each message goes into each chat from that chat's number (the web app's ForwardDialog). Above 3 chats
 * the API sends it as a paced broadcast instead, and says so.
 */
export function ForwardScreen() {
  const { api } = useMessaging();
  const pending = getForward();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 250); return () => clearTimeout(timer); }, [query]);
  const chats = useConversations("all", search);
  const [targets, setTargets] = useState<Conversation[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  if (!pending?.messages.length) {
    return <View className="flex-1 bg-card"><ScreenHeader title="Forward" />
      <InboxState icon={SendHorizontal} title="Nothing to forward" description="Go back to the chat, long press a message and choose Forward." action="Back to chat" onAction={goBack} />
    </View>;
  }
  const { conversationId, messages } = pending;
  function toggle(chat: Conversation) {
    setLimitHit(false);
    setTargets((old) => {
      if (old.some((item) => item.id === chat.id)) return old.filter((item) => item.id !== chat.id);
      if (old.length >= FORWARD_MAX_TARGETS) { setLimitHit(true); return old; }
      return [...old, chat];
    });
  }
  async function send() {
    if (!targets.length || sending) return;
    setSending(true); setError(null);
    const ids = targets.map((chat) => chat.id);
    let sent = 0;
    for (const message of messages) {
      const result = await api.forward(conversationId, message.id, ids);
      if (!result.ok) {
        setSending(false);
        setError(`${sent ? `${sent} of ${messages.length} forwarded. ` : ""}${result.message || "Couldn't forward. Try again."}`);
        return;
      }
      sent++;
    }
    setSending(false);
    // Back in the chat; above 3 chats the API keeps sending as a paced broadcast.
    goBack();
  }
  const summary = messages.length === 1 ? plainWhatsAppText(messageSummary(messages[0])) : `${messages.length} messages`;
  return <View className="flex-1 bg-card">
    <ScreenHeader title="Forward to…" subtitle={summary} />
    <View className="mx-5 mb-2 mt-3 flex-row items-center gap-2 rounded-xl bg-accent px-3">
      <CustomIcon as={Search} size={20} className="text-muted-foreground" />
      <CustomInput accessibilityLabel="Search chats" placeholder="Search chats" value={query} onChangeText={setQuery}
        autoCapitalize="none" autoCorrect={false} size="xl" className="min-w-0 flex-1 border-0 bg-transparent px-1" />
      {!!query && <MotionPressable role="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} className="h-11 w-9 items-center justify-center"><CustomIcon as={X} size={18} className="text-muted-foreground" /></MotionPressable>}
    </View>
    {limitHit && <CustomText role="alert" className="px-5 pb-2 text-xs text-warning-fg">You can forward to up to {FORWARD_MAX_TARGETS} chats at once.</CustomText>}
    {targets.length > 3 && <CustomText className="px-5 pb-2 text-xs leading-5 text-muted-foreground">More than 3 chats: Roklo sends this as a paced broadcast, so your number stays safe.</CustomText>}
    {chats.error && <View className="px-5 pb-2"><CustomAlert tone="error">{chats.error}</CustomAlert></View>}
    <FlatList data={chats.rows} keyExtractor={(chat) => chat.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }} onEndReached={chats.loadMore} onEndReachedThreshold={0.4}
      ItemSeparatorComponent={() => <View className="ml-[84px] bg-border" style={{ height: StyleSheet.hairlineWidth }} />}
      renderItem={({ item }) => {
        const picked = targets.some((chat) => chat.id === item.id);
        const name = item.name || item.mobileNumber || "Unknown contact";
        return <MotionPressable role="checkbox" accessibilityLabel={name} aria-checked={picked} accessibilityState={{ checked: picked }} onPress={() => toggle(item)}
          className="min-h-[68px] flex-row items-center gap-4 px-5 py-2.5 active:bg-accent">
          <View>
            <ChatAvatar conversationId={item.id} name={name} size={44} />
            {picked && <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary">
              <CustomIcon as={Check} size={11} strokeWidth={3} className="text-primary-foreground" />
            </View>}
          </View>
          <View className="min-w-0 flex-1">
            <CustomText numberOfLines={1} className="font-sans-semibold text-base">{name}</CustomText>
            {item.isGroup && <CustomText className="text-xs text-muted-foreground">Group</CustomText>}
          </View>
          <View className={cn("h-6 w-6 items-center justify-center rounded-full border-2", picked ? "border-primary bg-primary" : "border-ink-300")}>
            {picked && <CustomIcon as={Check} size={13} strokeWidth={3} className="text-primary-foreground" />}
          </View>
        </MotionPressable>;
      }}
      ListEmptyComponent={chats.loading ? <View className="items-center py-10"><CustomSpinner accessibilityLabel="Loading chats" /></View>
        : <InboxState icon={Search} title={search ? "No matching chats" : "No chats yet"} description={search ? "Try a different name or phone number." : "Chats on this number will appear here."} />} />
    {/* The picked chats and Send, along the bottom as on WhatsApp. */}
    {(targets.length > 0 || error) && <View className="absolute bottom-0 left-0 right-0 gap-2 border-t border-border bg-card px-4 py-3">
      {error && <CustomAlert tone="error" onDismiss={() => setError(null)}>{error}</CustomAlert>}
      {targets.length > 0 && <View className="flex-row items-center gap-3">
        <CustomText numberOfLines={2} className="min-w-0 flex-1 text-sm text-ink-700">{targets.map((chat) => chat.name || chat.mobileNumber).join(", ")}</CustomText>
        <MotionPressable role="button" accessibilityLabel={`Forward to ${targets.length} ${targets.length === 1 ? "chat" : "chats"}`} disabled={sending} onPress={() => void send()}
          className="h-12 w-12 items-center justify-center rounded-full bg-primary shadow-md shadow-black/15">
          {sending ? <CustomSpinner accessibilityLabel="Forwarding" /> : <CustomIcon as={SendHorizontal} size={21} className="ml-0.5 text-primary-foreground" />}
        </MotionPressable>
      </View>}
    </View>}
  </View>;
}
