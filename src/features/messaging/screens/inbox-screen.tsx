import { router } from "expo-router";
import {
  EyeOff,
  Link2,
  MailOpen,
  MessageCircle,
  MessageCirclePlus,
  Pin,
  PinOff,
  Search,
  SearchX,
  Smartphone,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackHandler, FlatList, StyleSheet, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { TabScreen } from "@/features/navigation/components/tab-screen";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { ConversationRow } from "../components/conversation-row";
import { InboxSkeleton, InboxState } from "../components/inbox-state";
import { PausedListHeader, ReconnectDock, UnpluggedArt } from "../components/reconnect-dock";
import { useConversations } from "../hooks/use-conversations";
import { useMessaging } from "../providers/messaging-provider";
import { connectionState, numberName, type ChatFilter, type Conversation } from "../types";

const filters: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "All chats" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
  { id: "waiting", label: "Needs reply" },
];
const countChats = (count: number) => `${count} ${count === 1 ? "chat" : "chats"}`;
export function InboxScreen() {
  return <InboxContent />;
}
function InboxContent() {
  const { api, activeNumber, loading, error, refreshNumbers } = useMessaging();
  const workspace = useAppSelector(selectActiveWorkspace);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const chats = useConversations(filter, search);
  // WhatsApp's long-press selection: the title row becomes Pin, Remove and the rest for the picked chats.
  // Searching keeps it, so chats found by different searches can be picked together; another number or
  // filter starts with nothing picked.
  const listKey = `${activeNumber?.id}:${filter}`;
  const [selection, setSelection] = useState<{ key: string; rows: Conversation[] }>({
    key: listKey,
    rows: [],
  });
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  // Each picked chat as the list has it now (pinned, unread), or as it was picked while a search hides it.
  const picked = (selection.key === listKey ? selection.rows : []).map(
    (row) => chats.rows.find((current) => current.id === row.id) ?? row,
  );
  const selected = picked.map((row) => row.id);
  const selecting = picked.length > 0;
  const clearSelection = useCallback(() => {
    setSelection({ key: listKey, rows: [] });
    setConfirmingRemove(false);
  }, [listKey]);
  const toggle = (row: Conversation) => {
    setSelection({
      key: listKey,
      rows: selected.includes(row.id)
        ? picked.filter((other) => other.id !== row.id)
        : [...picked, row],
    });
    setConfirmingRemove(false);
  };
  // Android's back closes the confirmation, then drops the selection, as on WhatsApp.
  useEffect(() => {
    if (!selecting) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirmingRemove) setConfirmingRemove(false);
      else clearSelection();
      return true;
    });
    return () => subscription.remove();
  }, [selecting, confirmingRemove, clearSelection]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 4000 : 2000);
    return () => clearTimeout(timer);
  }, [notice]);
  // The tab's own screen, so its title row can turn into the selected chats' actions.
  const shell = (content: ReactNode, header?: ReactNode) => (
    <TabScreen tab="inbox" header={header}>
      {content}
    </TabScreen>
  );
  if (workspace?.status === "DISABLED")
    return shell(
      <InboxState
        icon={Smartphone}
        title="Workspace disabled"
        description="Choose another workspace to continue."
        action="Choose workspace"
        onAction={() => router.push("/workspaces")}
      />,
    );
  if (!activeNumber) {
    // Resolve the connection before rendering a state-specific layout: no chat placeholders, search or filters yet.
    if (loading)
      return shell(
        <View className="flex-1 items-center justify-center">
          <CustomSpinner accessibilityLabel="Checking your WhatsApp connection" />
        </View>,
      );
    return shell(
      <InboxState
        icon={error ? Smartphone : MessageCircle}
        title={error ? "Couldn't load your numbers" : "Your conversations start here"}
        description={
          error || "Connect your business WhatsApp number to read and reply to customers in Roklo."
        }
        action={error ? "Try again" : "Connect a number"}
        onAction={() => (error ? void refreshNumbers() : router.push("/connect-number"))}
      />,
    );
  }
  // Never linked (no phone yet): a first-time link prompt, not the reconnect dock meant for dropped connections.
  if (!activeNumber.phoneNumber) {
    return shell(
      <InboxState
        art={<UnpluggedArt />}
        title="Link your WhatsApp"
        description={`Link ${activeNumber.displayName || "your business number"} with a code from your phone to start chatting with customers in Roklo.`}
        action="Link WhatsApp"
        actionIcon={Link2}
        onAction={() =>
          router.push({ pathname: "/connect-number", params: { sessionId: activeNumber.id } })
        }
      />,
    );
  }
  // Each chip is as wide as its label plus an even share of the spare width; the label keeps one size
  // (no auto-fit, which re-measured and shifted the text on Android) and sits centred both ways.
  const filterRow = (
    <View className="flex-row gap-1.5 bg-card px-5 pb-2" accessibilityLabel="Chat filters">
      {filters.map((item) => (
        <MotionPressable
          key={item.id}
          role="button"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: filter === item.id }}
          onPress={() => setFilter(item.id)}
          hitSlop={{ top: 4, bottom: 4 }}
          className={cn(
            "h-9 grow flex-row items-center justify-center rounded-full px-2.5",
            filter === item.id ? "bg-primary" : "bg-accent active:bg-muted",
          )}
        >
          <CustomText
            numberOfLines={1}
            style={{ includeFontPadding: false, textAlignVertical: "center" }}
            className={cn(
              "text-center text-[13px] leading-[18px]",
              filter === item.id
                ? "font-sans-semibold text-primary-foreground"
                : "font-sans-medium text-muted-foreground",
            )}
          >
            {item.label}
          </CustomText>
        </MotionPressable>
      ))}
    </View>
  );
  const state = connectionState(activeNumber);
  const offline = state !== "connected";
  // As on WhatsApp: Pin unless every picked chat is already pinned.
  const pinning = picked.some((row) => !row.isPinned);
  /** Optimistic: the pins change at once, go back if the API refuses, then the list reorders (pinned first). */
  async function togglePinned() {
    const targets = picked.filter((row) => row.isPinned !== pinning);
    const ids = targets.map((row) => row.id);
    clearSelection();
    chats.patch(ids, () => ({ isPinned: pinning }));
    const results = await Promise.all(ids.map((id) => api.setPinned(id, pinning)));
    const failed = ids.filter((_, index) => !results[index].ok);
    if (failed.length) chats.patch(failed, () => ({ isPinned: !pinning }));
    chats.reload();
    if (failed.length) {
      const refused = results.find((result) => !result.ok);
      setNotice({
        text:
          refused?.message ||
          `Couldn't ${pinning ? "pin" : "unpin"} ${failed.length === 1 ? "this chat" : "these chats"}. Try again.`,
        error: true,
      });
    } else
      setNotice({
        text: `${ids.length === 1 ? "Chat" : countChats(ids.length)} ${pinning ? "pinned" : "unpinned"}`,
      });
  }
  const unreadPicked = picked.filter((row) => row.unreadCount > 0);
  const waitingPicked = picked.filter((row) => row.status === "AWAITING_REPLY");
  /** Optimistic: the badges clear at once and come back if the API refuses. */
  async function markPickedRead() {
    const before = new Map(unreadPicked.map((row) => [row.id, row.unreadCount]));
    const ids = [...before.keys()];
    clearSelection();
    chats.patch(ids, () => ({ unreadCount: 0 }));
    const result = await api.markRead(ids);
    if (!result.ok) {
      chats.patch(ids, (row) => ({ unreadCount: before.get(row.id) ?? row.unreadCount }));
      setNotice({
        text:
          result.message ||
          `Couldn't mark ${ids.length === 1 ? "this chat" : "these chats"} as read. Try again.`,
        error: true,
      });
      return;
    }
    // The Unread filter drops them on the quiet reload.
    if (filter === "unread") chats.reload();
    setNotice({ text: `Marked ${countChats(ids.length)} as read` });
  }
  /** Out of "Needs reply" without a reply; a chat's next message brings it back. */
  async function ignorePicked() {
    const targets = waitingPicked;
    const ids = targets.map((row) => row.id);
    clearSelection();
    chats.patch(ids, () => ({ status: "OPEN" }));
    const result = await api.ignoreWaiting(targets);
    // Skipped chats (a newer message came in) and the Needs reply filter both need the server's view.
    chats.reload();
    if (!result.ok) {
      chats.patch(ids, () => ({ status: "AWAITING_REPLY" }));
      setNotice({
        text:
          result.message ||
          `Couldn't ignore ${ids.length === 1 ? "this chat" : "these chats"}. Try again.`,
        error: true,
      });
      return;
    }
    const updated = result.data?.updated ?? ids.length;
    const skipped = ids.length - updated;
    setNotice({
      text: !updated
        ? `A new message came in, so ${ids.length === 1 ? "this chat is" : "these chats are"} still waiting.`
        : skipped
          ? `${countChats(updated)} ignored. ${skipped} got a new message and ${skipped === 1 ? "is" : "are"} still waiting.`
          : updated === 1
            ? "Chat ignored. It comes back if they message again."
            : `${countChats(updated)} ignored. They come back if they message again.`,
    });
  }
  async function removePicked() {
    const ids = picked.map((row) => row.id);
    setRemoving(true);
    const result = await api.removeChats(ids);
    setRemoving(false);
    if (!result.ok) {
      setNotice({
        text:
          result.message ||
          `Couldn't remove ${ids.length === 1 ? "this chat" : "these chats"}. Try again.`,
        error: true,
      });
      return;
    }
    clearSelection();
    chats.remove(ids);
    setNotice({ text: `Removed ${countChats(ids.length)}` });
  }
  const single = picked.length === 1 ? picked[0] : null;
  // While chats are picked the title row becomes WhatsApp's top bar: clear, how many, then the actions.
  const actionBar = (
    <View
      className="-mx-2.5 min-h-11 flex-row items-center gap-1"
      accessibilityLabel="Chat actions"
    >
      <ActionButton label="Clear selection" icon={X} onPress={clearSelection} />
      <CustomText
        className="min-w-0 flex-1 px-1 font-sans-semibold text-[22px] leading-8"
        accessibilityLiveRegion="polite"
      >
        {picked.length}
      </CustomText>
      {/* Pinning needs the number online, as on the web inbox. */}
      <ActionButton
        label={pinning ? "Pin" : "Unpin"}
        icon={pinning ? Pin : PinOff}
        disabled={offline || removing}
        onPress={() => void togglePinned()}
      />
      {unreadPicked.length > 0 && (
        <ActionButton
          label="Mark as read"
          icon={MailOpen}
          disabled={removing}
          onPress={() => void markPickedRead()}
        />
      )}
      {/* Only chats waiting for a reply can be ignored, as on the web inbox. */}
      {waitingPicked.length > 0 && (
        <ActionButton
          label="Ignore"
          icon={EyeOff}
          disabled={offline || removing}
          onPress={() => void ignorePicked()}
        />
      )}
      <ActionButton
        label="Remove"
        icon={Trash2}
        disabled={removing}
        selected={confirmingRemove}
        onPress={() => setConfirmingRemove((open) => !open)}
      />
    </View>
  );
  return shell(
    <View className="flex-1 bg-card">
      <View className="mx-5 mb-3 flex-row items-center gap-2 rounded-xl bg-accent px-3">
        <CustomIcon as={Search} size={20} className="text-muted-foreground" />
        <CustomInput
          accessibilityLabel="Search chats"
          placeholder="Search chats"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          size="xl"
          className="min-w-0 flex-1 border-0 bg-transparent px-1"
        />
        {!!query && (
          <MotionPressable
            role="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery("")}
            className="h-11 w-9 items-center justify-center"
          >
            <CustomIcon as={X} size={18} className="text-muted-foreground" />
          </MotionPressable>
        )}
      </View>
      {/* Remove asks first, inline under the search bar (not a dialog). */}
      {selecting && confirmingRemove && (
        <View className="mx-5 mb-3">
          <View role="alert" className="gap-2 rounded-xl border border-border bg-card p-4">
            <CustomText className="font-sans-semibold text-base">
              {single
                ? `Remove the chat with ${single.name || single.mobileNumber || "this contact"}?`
                : `Remove ${countChats(picked.length)}?`}
            </CustomText>
            <CustomText className="text-sm text-muted-foreground">
              {`${single ? "It leaves" : "They leave"} the inbox for your whole team. Nothing is deleted on WhatsApp, and ${single ? "it" : "a chat"} comes back when a new message arrives.`}
            </CustomText>
            <View className="mt-1 flex-row justify-end gap-2">
              <CustomButton
                variant="ghost"
                size="sm"
                disabled={removing}
                onPress={() => setConfirmingRemove(false)}
              >
                Cancel
              </CustomButton>
              <CustomButton
                variant="destructive-solid"
                size="sm"
                loading={removing}
                onPress={() => void removePicked()}
              >
                Remove
              </CustomButton>
            </View>
          </View>
        </View>
      )}
      {chats.error && (
        <View className="gap-1 px-5 py-3">
          <CustomAlert tone="error">{chats.error}</CustomAlert>
          <CustomButton variant="link" onPress={chats.refresh}>
            Try again
          </CustomButton>
        </View>
      )}
      {chats.loading && !chats.rows.length ? (
        <View>
          {filterRow}
          <InboxSkeleton />
        </View>
      ) : (
        <FlatList
          data={chats.rows}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          windowSize={7}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: offline ? 120 : 96 }}
          refreshing={chats.refreshing}
          onRefresh={chats.refresh}
          onEndReached={chats.loadMore}
          onEndReachedThreshold={0.4}
          // WhatsApp-style divider: a hairline under the text column (row padding 20 + photo 48 + gap 16), running to the screen edge.
          ItemSeparatorComponent={() => (
            <View className="ml-[84px] bg-border" style={{ height: StyleSheet.hairlineWidth }} />
          )}
          extraData={selected}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              selected={selected.includes(item.id)}
              selecting={selecting}
              onLongPress={() => toggle(item)}
              onPress={() =>
                selecting
                  ? toggle(item)
                  : router.push({
                      pathname: "/chat/[id]",
                      params: { id: item.id, sessionId: item.sessionId },
                    })
              }
            />
          )}
          // The filters scroll away with the chats, as on WhatsApp; the search bar above stays put.
          ListHeaderComponent={
            <>
              {filterRow}
              {offline && chats.rows.length > 0 && <PausedListHeader />}
            </>
          }
          ListEmptyComponent={
            chats.error ? null : offline && !search && filter === "all" ? (
              <InboxState
                art={<UnpluggedArt />}
                title={state === "connecting" ? "Almost there" : "Waiting for your phone"}
                description={`Chats from ${numberName(activeNumber)} will sync here as soon as it's back online.`}
              />
            ) : (
              <InboxState
                icon={search ? SearchX : MessageCircle}
                title={
                  search
                    ? "No matching chats"
                    : filter === "unread"
                      ? "You're all caught up"
                      : "No chats here yet"
                }
                description={
                  search
                    ? "Try a different name or phone number."
                    : filter === "all"
                      ? "Start a conversation with a customer. Your WhatsApp chats will appear here as they sync."
                      : "Conversations matching this filter will appear here."
                }
                action={search || filter !== "all" ? "Show all chats" : "New chat"}
                onAction={() => {
                  if (search || filter !== "all") {
                    setQuery("");
                    setFilter("all");
                  } else router.push("/new-chat");
                }}
              />
            )
          }
          ListFooterComponent={
            chats.loadingMore ? (
              <View className="items-center p-4">
                <CustomSpinner accessibilityLabel="Loading more chats" />
              </View>
            ) : null
          }
        />
      )}
      {offline && (
        <ReconnectDock
          number={activeNumber}
          context="inbox"
          className="absolute bottom-4 left-4 right-4"
        />
      )}
      {!offline && !selecting && chats.rows.length > 0 && (
        <MotionPressable
          role="button"
          accessibilityLabel="New chat"
          onPress={() => router.push("/new-chat")}
          className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-black/20"
        >
          <CustomIcon as={MessageCirclePlus} size={24} className="text-primary-foreground" />
        </MotionPressable>
      )}
      {notice && (
        <View
          pointerEvents="none"
          className={cn(
            "absolute left-0 right-0 items-center",
            offline ? "bottom-28" : "bottom-24",
          )}
        >
          <View
            role={notice.error ? "alert" : "status"}
            className={cn(
              "mx-5 rounded-full px-3 py-1.5 shadow-sm shadow-black/10",
              notice.error ? "bg-error-bg" : "bg-ink-900",
            )}
          >
            <CustomText className={cn("text-xs", notice.error ? "text-error-fg" : "text-white")}>
              {notice.text}
            </CustomText>
          </View>
        </View>
      )}
    </View>,
    selecting ? actionBar : undefined,
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled,
  selected,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const { colors } = useRokloTheme();
  // Fixed classes; selected and disabled go on as a style. A pressable whose classes gain a new kind of
  // style after its first render is re-created by NativeWind, and its dev warning crashes.
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, expanded: selected }}
      disabled={disabled}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
      style={{ opacity: disabled ? 0.4 : 1, ...(selected && { backgroundColor: colors.muted }) }}
    >
      <CustomIcon as={icon} size={21} className="text-foreground" />
    </MotionPressable>
  );
}
