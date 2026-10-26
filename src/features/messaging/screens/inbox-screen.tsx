import { router } from "expo-router";
import { Link2, MessageCircle, MessageCirclePlus, Search, SearchX, Smartphone, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { TabScreen } from "@/features/navigation/components/tab-screen";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { ConversationRow } from "../components/conversation-row";
import { InboxSkeleton, InboxState } from "../components/inbox-state";
import { PausedListHeader, ReconnectDock, UnpluggedArt } from "../components/reconnect-dock";
import { useConversations } from "../hooks/use-conversations";
import { useMessaging } from "../providers/messaging-provider";
import { connectionState, numberName, type ChatFilter } from "../types";

const filters: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "All chats" }, { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" }, { id: "waiting", label: "Needs reply" },
];
export function InboxScreen() {
  return <TabScreen tab="inbox"><InboxContent /></TabScreen>;
}
function InboxContent() {
  const { activeNumber, loading, error, refreshNumbers } = useMessaging();
  const workspace = useAppSelector(selectActiveWorkspace);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 250); return () => clearTimeout(timer); }, [query]);
  const chats = useConversations(filter, search);
  if (workspace?.status === "DISABLED") return <InboxState icon={Smartphone} title="Workspace disabled" description="Choose another workspace to continue." action="Choose workspace" onAction={() => router.push("/workspaces")} />;
  if (!activeNumber) {
    // Resolve the connection before rendering a state-specific layout: no chat placeholders, search or filters yet.
    if (loading) return <View className="flex-1 items-center justify-center"><CustomSpinner accessibilityLabel="Checking your WhatsApp connection" /></View>;
    return <InboxState icon={error ? Smartphone : MessageCircle} title={error ? "Couldn't load your numbers" : "Your conversations start here"}
      description={error || "Connect your business WhatsApp number to read and reply to customers in Roklo."}
      action={error ? "Try again" : "Connect a number"} onAction={() => error ? void refreshNumbers() : router.push("/connect-number")} />;
  }
  // Never linked (no phone yet): a first-time link prompt, not the reconnect dock meant for dropped connections.
  if (!activeNumber.phoneNumber) {
    return <InboxState art={<UnpluggedArt />}
      title="Link your WhatsApp"
      description={`Link ${activeNumber.displayName || "your business number"} with a code from your phone to start chatting with customers in Roklo.`}
      action="Link WhatsApp" actionIcon={Link2} onAction={() => router.push({ pathname: "/connect-number", params: { sessionId: activeNumber.id } })} />;
  }
  // Each chip is as wide as its label plus an even share of the spare width; the label keeps one size
  // (no auto-fit, which re-measured and shifted the text on Android) and sits centred both ways.
  const filterRow = <View className="flex-row gap-1.5 bg-card px-5 pb-2" accessibilityLabel="Chat filters">
    {filters.map((item) => <MotionPressable key={item.id} role="button" accessibilityLabel={item.label} accessibilityState={{ selected: filter === item.id }}
      onPress={() => setFilter(item.id)} hitSlop={{ top: 4, bottom: 4 }}
      className={cn("h-9 grow flex-row items-center justify-center rounded-full px-2.5", filter === item.id ? "bg-primary" : "bg-accent active:bg-muted")}>
      <CustomText numberOfLines={1} style={{ includeFontPadding: false, textAlignVertical: "center" }}
        className={cn("text-center text-[13px] leading-[18px]", filter === item.id ? "font-sans-semibold text-primary-foreground" : "font-sans-medium text-muted-foreground")}>{item.label}</CustomText>
    </MotionPressable>)}
  </View>;
  const state = connectionState(activeNumber);
  const offline = state !== "connected";
  return <View className="flex-1 bg-card">
    <View className="mx-5 mb-3 flex-row items-center gap-2 rounded-xl bg-accent px-3">
      <CustomIcon as={Search} size={20} className="text-muted-foreground" />
      <CustomInput accessibilityLabel="Search chats" placeholder="Search chats" value={query} onChangeText={setQuery}
        autoCapitalize="none" autoCorrect={false} size="xl" className="min-w-0 flex-1 border-0 bg-transparent px-1" />
      {!!query && <MotionPressable role="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} className="h-11 w-9 items-center justify-center"><CustomIcon as={X} size={18} className="text-muted-foreground" /></MotionPressable>}
    </View>
    {chats.error && <View className="gap-1 px-5 py-3"><CustomAlert tone="error">{chats.error}</CustomAlert><CustomButton variant="link" onPress={chats.refresh}>Try again</CustomButton></View>}
    {chats.loading && !chats.rows.length ? <View>{filterRow}<InboxSkeleton /></View> : <FlatList data={chats.rows} keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={12} windowSize={7}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: offline ? 120 : 96 }} refreshing={chats.refreshing} onRefresh={chats.refresh}
      onEndReached={chats.loadMore} onEndReachedThreshold={0.4}
      // WhatsApp-style divider: a hairline under the text column (row padding 20 + photo 48 + gap 16), running to the screen edge.
      ItemSeparatorComponent={() => <View className="ml-[84px] bg-border" style={{ height: StyleSheet.hairlineWidth }} />}
      renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, sessionId: item.sessionId } })} />}
      // The filters scroll away with the chats, as on WhatsApp; the search bar above stays put.
      ListHeaderComponent={<>{filterRow}{offline && chats.rows.length > 0 && <PausedListHeader />}</>}
      ListEmptyComponent={chats.error ? null : offline && !search && filter === "all"
        ? <InboxState art={<UnpluggedArt />} title={state === "connecting" ? "Almost there" : "Waiting for your phone"}
          description={`Chats from ${numberName(activeNumber)} will sync here as soon as it's back online.`} />
        : <InboxState icon={search ? SearchX : MessageCircle} title={search ? "No matching chats" : filter === "unread" ? "You're all caught up" : "No chats here yet"}
          description={search ? "Try a different name or phone number." : filter === "all"
            ? "Start a conversation with a customer. Your WhatsApp chats will appear here as they sync." : "Conversations matching this filter will appear here."}
          action={search || filter !== "all" ? "Show all chats" : "New chat"}
          onAction={() => { if (search || filter !== "all") { setQuery(""); setFilter("all"); } else router.push("/new-chat"); }} />}
      ListFooterComponent={chats.loadingMore ? <View className="items-center p-4"><CustomSpinner accessibilityLabel="Loading more chats" /></View> : null} />}
    {offline && <ReconnectDock number={activeNumber} context="inbox" className="absolute bottom-4 left-4 right-4" />}
    {!offline && chats.rows.length > 0 &&<MotionPressable role="button" accessibilityLabel="New chat" onPress={() => router.push("/new-chat")}
      className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-black/20">
      <CustomIcon as={MessageCirclePlus} size={24} className="text-primary-foreground" />
    </MotionPressable>}
  </View>;
}
