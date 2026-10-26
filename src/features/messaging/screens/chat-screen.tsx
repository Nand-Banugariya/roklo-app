import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronDown, Copy, Forward, Hand, Info, MessageCircle, Pin, PinOff, Plus, Reply, X, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { KeyboardScreen } from "@/features/navigation/components/keyboard-screen";
import { goBack } from "@/features/navigation/components/screen-header";
import { cn } from "@/lib/utils";
import { ChatComposer, type ComposerHandle, type ComposerReply, type ComposerSend } from "../components/chat-composer";
import { EmojiPanel } from "../components/emoji-panel";
import { ChatAvatar } from "../components/chat-avatar";
import { ChatWallpaper } from "../components/chat-wallpaper";
import { InboxState, ThreadSkeleton } from "../components/inbox-state";
import { DaySeparator, MessageBubble } from "../components/message-bubble";
import { ReconnectDock } from "../components/reconnect-dock";
import { TypingBubble } from "../components/typing-bubble";
import { useChatThread } from "../hooks/use-chat-thread";
import { useMessaging } from "../providers/messaging-provider";
import { typingLabel, useChatTyping } from "../providers/typing-provider";
import { connectionState, isConnected, numberName, numberPhone, type ChatMessage } from "../types";
import { dayLabel, minutesApart, sameDay } from "../utils/chat-dates";
import { canForward, canReact, FORWARD_MAX_MESSAGES, MAX_PINNED_MESSAGES, messageSummary, myReaction, nextReactions, QUICK_REACTIONS, setForward } from "../utils/message-actions";
import { plainWhatsAppText } from "../utils/whatsapp-text";

const QUICK_STARTS = ["Hi! How can we help you today?", "Thanks for reaching out — one moment please."];
const JUMP_AFTER = 480;
const JUMP_IN = FadeIn.duration(150).reduceMotion(ReduceMotion.System);
const JUMP_OUT = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

export function ChatScreen() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  return <ChatThread key={`${id}:${sessionId}`} id={id} sessionId={sessionId} />;
}
function ChatThread({ id, sessionId }: { id: string; sessionId: string }) {
  const { api, activeNumber, userId } = useMessaging();
  const chat = useChatThread(id, sessionId);
  // WhatsApp's long-press selection: picked message ids, and whether the full emoji list is open for a reaction.
  const [selected, setSelected] = useState<string[]>([]);
  const [reactMore, setReactMore] = useState(false);
  const [replyTo, setReplyTo] = useState<ComposerReply | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [pinIndex, setPinIndex] = useState(0);
  /** The message just jumped to (from a quote or the pinned bar), flashed once. */
  const [flashId, setFlashId] = useState<string | null>(null);
  /** Every message jumped to in this visit, so its highlight can fade out instead of vanishing. */
  const [jumped, setJumped] = useState<string[]>([]);
  const pendingJump = useRef<string[] | null>(null);
  // The loaded messages for the jump, which finishes after older pages render.
  const loaded = useRef<ChatMessage[]>([]);
  useEffect(() => { loaded.current = chat.messages; }, [chat.messages]);
  const composer = useRef<ComposerHandle>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const fresh = useRef(new Set<string>());
  const state = activeNumber ? connectionState(activeNumber) : null;
  // A note never reaches WhatsApp, so it only needs a live number; admin-only groups allow notes only.
  const canNote = !!activeNumber && isConnected(activeNumber) && activeNumber.isActive !== false && chat.valid && !!chat.conversation;
  const allowed = canNote && activeNumber.canSend !== false && !!chat.conversation?.canSendMessage;
  const name = chat.conversation?.name || chat.conversation?.mobileNumber || "Conversation";
  const live = useChatTyping(chat.conversation);
  const typing = typingLabel(live);
  /** Optimistic: the bubble appears instantly with a clock, then swaps for the server copy. Resolves false to restore the draft. */
  async function send({ text, type, files, replyToMessageId }: ComposerSend) {
    if (type === "REPLY" ? !allowed : !canNote) return false;
    setSendError(null);
    const localId = `local-${Date.now()}`;
    fresh.current.add(localId);
    chat.append({ id: localId, conversationId: id, type, direction: "OUTBOUND", body: text || null, files: [], fileNames: files.map((file) => file.name),
      deliveryStatus: "QUEUED", failureReason: null, createdAt: new Date().toISOString(), isRevoked: false,
      replyToPreview: replyTo && replyTo.message.id === replyToMessageId ? { id: replyTo.message.id, body: replyTo.message.body,
        files: replyTo.message.files, fileNames: replyTo.message.fileNames, contentType: replyTo.message.contentType } : null });
    list.current?.scrollToOffset({ offset: 0, animated: true });
    const result = await api.send(id, text, type, files, replyToMessageId);
    if (!result.ok) {
      chat.replace(localId, null);
      setSendError(result.message || "Couldn't send your message. Your draft is back in the box; try again.");
      return false;
    }
    chat.replace(localId, result.data);
    return true;
  }
  const picked = chat.messages.filter((message) => selected.includes(message.id));
  const single = picked.length === 1 ? picked[0] : null;
  const selecting = selected.length > 0;
  const pinned = chat.messages.filter((message) => message.isPinned && !message.isRevoked);
  const shownPin = pinned.length ? pinned[pinIndex % pinned.length] : null;
  function clearSelection() { setSelected([]); setReactMore(false); }
  const toggle = useCallback((messageId: string) => {
    setSelected((old) => old.includes(messageId) ? old.filter((value) => value !== messageId) : [...old, messageId]);
    setReactMore(false);
  }, []);
  // Android's back drops the selection first, as on WhatsApp.
  useEffect(() => {
    if (!selecting) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { clearSelection(); return true; });
    return () => subscription.remove();
  }, [selecting]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 4000 : 2000);
    return () => clearTimeout(timer);
  }, [notice]);
  function authorOf(message: ChatMessage) {
    if (message.direction === "OUTBOUND" || message.type === "PRIVATE_NOTE") return !message.createdById || message.createdById === userId ? "You" : "a teammate";
    if (chat.conversation?.isGroup) return message.sender?.name || (message.sender?.mobileNumber ? numberPhone({ phoneNumber: message.sender.mobileNumber }) : "Member");
    return name;
  }
  const startReply = useCallback((message: ChatMessage) => {
    setReplyTo({ message, author: authorOf(message) });
    clearSelection();
  // authorOf reads the latest chat and user on each call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.conversation, userId, name]);
  /** Optimistic, as WhatsApp: the chip changes at once and goes back if the API refuses. */
  const react = useCallback(async (message: ChatMessage, emoji: string) => {
    if (!allowed || !canReact(message)) return;
    const next = nextReactions(message, userId, emoji);
    const before = message.reactions ?? [];
    chat.patch(message.id, { reactions: next.reactions });
    const result = await api.react(id, message.id, next.emoji);
    if (result.ok && result.data?.id) chat.patch(message.id, result.data);
    else if (!result.ok) { chat.patch(message.id, { reactions: before }); setNotice({ text: result.message || "Couldn't react. Try again.", error: true }); }
  // chat.patch only sets state; the latest copy of the message is passed in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, api, id, userId]);
  async function togglePin(message: ChatMessage) {
    const pinning = !message.isPinned;
    if (pinning && pinned.length >= MAX_PINNED_MESSAGES) { setNotice({ text: `You can pin up to ${MAX_PINNED_MESSAGES} messages. Unpin one first.`, error: true }); return; }
    clearSelection();
    chat.patch(message.id, { isPinned: pinning });
    const result = await api.togglePin(id, message.id);
    if (!result.ok) { chat.patch(message.id, { isPinned: !pinning }); setNotice({ text: result.message || "Couldn't change the pin. Try again.", error: true }); return; }
    if (result.data?.id) chat.patch(message.id, result.data);
    setNotice({ text: pinning ? "Message pinned" : "Message unpinned" });
  }
  async function copy() {
    const text = [...picked].reverse().map((message) => message.body?.trim()).filter(Boolean).join("\n");
    clearSelection();
    if (!text) return;
    try { await Clipboard.setStringAsync(plainWhatsAppText(text)); setNotice({ text: picked.length > 1 ? "Messages copied" : "Message copied" }); }
    catch { setNotice({ text: "Couldn't copy. Try again.", error: true }); }
  }
  function forward() {
    const messages = [...picked].reverse().filter(canForward);
    if (messages.length > FORWARD_MAX_MESSAGES) { setNotice({ text: `You can forward up to ${FORWARD_MAX_MESSAGES} messages at a time.`, error: true }); return; }
    setForward({ conversationId: id, messages });
    clearSelection();
    router.push("/forward");
  }
  /** Scrolls a loaded message (any of `ids`) to the middle of the screen and highlights it. */
  function scrollToMessage(ids: readonly string[]) {
    const index = loaded.current.findIndex((message) => ids.includes(message.id));
    if (index < 0) return false;
    const messageId = loaded.current[index].id;
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setJumped((old) => old.includes(messageId) ? old : [...old, messageId]);
    setFlashId(null);
    requestAnimationFrame(() => setFlashId(messageId));
    return true;
  }
  /** WhatsApp's tap on a quote: go to the quoted message, loading older pages first if it's further up. */
  const jumpTo = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    if (scrollToMessage(ids)) return;
    setNotice({ text: "Finding the message…" });
    const found = await chat.findOlder(ids);
    // Scroll once the older pages have rendered (the effect below, or now if they already have).
    if (found && !scrollToMessage(ids)) pendingJump.current = ids;
    else if (found) setNotice(null);
    else setNotice({ text: "Couldn't find this message in the chat. It may be too far back to load here.", error: true });
  // scrollToMessage reads the latest messages on each call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.findOlder]);
  useEffect(() => {
    const target = pendingJump.current;
    if (target && chat.messages.some((message) => target.includes(message.id))) {
      pendingJump.current = null;
      setNotice(null);
      // Give the list a frame to lay out the new rows.
      setTimeout(() => scrollToMessage(target), 50);
    }
  }, [chat.messages]);
  useEffect(() => {
    if (!flashId) return;
    // MESSAGE_HIGHLIGHT_MS on the web app.
    const timer = setTimeout(() => setFlashId(null), 2000);
    return () => clearTimeout(timer);
  }, [flashId]);
  /** The pinned bar: shows where the pin is, then steps to the next one, as on WhatsApp. */
  function jumpToPin() {
    if (!shownPin) return;
    void jumpTo([shownPin.id]);
    setPinIndex((value) => value + 1);
  }
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const away = event.nativeEvent.contentOffset.y > JUMP_AFTER;
    setShowJump((old) => old === away ? old : away);
  }, []);
  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    // Inverted list: index + 1 is the previous message in time.
    const previous = chat.messages[index + 1];
    const newDay = !previous ? !chat.more : !sameDay(previous.createdAt, item.createdAt);
    const first = newDay || !previous || previous.direction !== item.direction || previous.type !== item.type
      || minutesApart(previous.createdAt, item.createdAt) > 5;
    return <View>
      {newDay && <DaySeparator label={dayLabel(item.createdAt)} />}
      {/* WhatsApp's quick reactions, above the one picked message. */}
      {single?.id === item.id && allowed && canReact(item) && <View accessibilityLabel="Reactions"
        className={cn("mx-3 mt-2 flex-row items-center gap-0.5 rounded-full bg-card p-1 shadow-md shadow-black/15", item.direction === "OUTBOUND" ? "self-end" : "self-start")}>
        {QUICK_REACTIONS.map((emoji) => {
          const mine = myReaction(item, userId) === emoji;
          return <MotionPressable key={emoji} role="button" accessibilityLabel={mine ? `Remove ${emoji}` : `React ${emoji}`} accessibilityState={{ selected: mine }}
            onPress={() => { void react(item, emoji); clearSelection(); }}
            className={cn("h-10 w-10 items-center justify-center rounded-full active:bg-ink-75", mine && "bg-ink-100")}>
            <CustomText className="text-[22px] leading-[28px]">{emoji}</CustomText>
          </MotionPressable>;
        })}
        <MotionPressable role="button" accessibilityLabel="More reactions" accessibilityState={{ expanded: reactMore }} onPress={() => setReactMore((open) => !open)}
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-75 active:bg-ink-150">
          <CustomIcon as={Plus} size={18} className="text-ink-700" />
        </MotionPressable>
      </View>}
      <MessageBubble message={item} first={first} fresh={fresh.current.has(item.id)} isGroup={chat.conversation?.isGroup}
        selected={selected.includes(item.id)} selecting={selecting} myUserId={userId} onSelect={() => toggle(item.id)}
        onReply={allowed || (canNote && item.type === "PRIVATE_NOTE") ? (item.isRevoked || item.id.startsWith("local-") ? undefined : () => startReply(item)) : undefined}
        onReact={allowed && canReact(item) ? (emoji) => void react(item, emoji) : undefined}
        onQuotePress={(ids) => void jumpTo(ids)} flash={jumped.includes(item.id) ? flashId === item.id : undefined} />
    </View>;
  // Reply, react and selection read the latest state through these.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, chat.more, chat.conversation?.isGroup, selected, selecting, single?.id, reactMore, allowed, canNote, userId, flashId, jumped, jumpTo]);
  return <KeyboardScreen className="flex-1 bg-card">
    {/* While messages are picked the header becomes WhatsApp's action bar (inline, not a menu). */}
    {selecting ? <View className="min-h-16 flex-row items-center gap-1 border-b border-border bg-card px-2 py-2" accessibilityLabel="Message actions">
      <MotionPressable role="button" accessibilityLabel="Clear selection" onPress={clearSelection} className="h-11 w-11 items-center justify-center rounded-full active:bg-accent">
        <CustomIcon as={X} size={22} className="text-foreground" />
      </MotionPressable>
      <CustomText className="min-w-0 flex-1 font-sans-semibold text-lg" accessibilityLiveRegion="polite">{selected.length}</CustomText>
      {single && !single.isRevoked && !single.id.startsWith("local-") && (allowed || (canNote && single.type === "PRIVATE_NOTE")) && <ActionButton label="Reply" icon={Reply} onPress={() => startReply(single)} />}
      {single && canNote && !single.isRevoked && single.type !== "SYSTEM" && !single.id.startsWith("local-") && <ActionButton label={single.isPinned ? "Unpin" : "Pin"} icon={single.isPinned ? PinOff : Pin} onPress={() => void togglePin(single)} />}
      {picked.some((message) => !message.isRevoked && message.body?.trim()) && <ActionButton label="Copy" icon={Copy} onPress={() => void copy()} />}
      {allowed && picked.length > 0 && picked.every(canForward) && <ActionButton label="Forward" icon={Forward} onPress={forward} />}
    </View> : <View className="min-h-16 flex-row items-center gap-1 border-b border-border bg-card px-2 py-2">
      <MotionPressable role="button" accessibilityLabel="Back to chats" onPress={goBack} className="h-11 w-11 items-center justify-center rounded-full active:bg-accent"><CustomIcon as={ArrowLeft} size={23} className="text-foreground" /></MotionPressable>
      <MotionPressable role="button" accessibilityLabel={`${name}, open contact details`} disabled={!chat.conversation}
        onPress={() => router.push({ pathname: "/chat-info", params: { id, sessionId } })}
        className="min-h-11 min-w-0 flex-1 flex-row items-center gap-3 rounded-xl py-1 pr-2 active:bg-accent">
        <ChatAvatar conversationId={chat.conversation?.id} name={name} size={40} />
        <View className="min-w-0 flex-1 gap-0.5">
          <CustomText className="font-sans-semibold text-base" numberOfLines={1}>{name}</CustomText>
          {typing ? <CustomText className="font-sans-medium text-xs text-primary" numberOfLines={1} accessibilityLiveRegion="polite">{typing}</CustomText> : <View className="flex-row items-center">
            <CustomText className="shrink text-xs text-muted-foreground" numberOfLines={1}>{activeNumber ? `via ${numberName(activeNumber)} · ${numberPhone(activeNumber).slice(-5)}` : "Choose a number"}</CustomText>
            {state && state !== "connected" && <CustomText className="shrink-0 font-sans-semibold text-xs text-warning-fg"> · {state === "connecting" ? "Connecting…" : "Not connected"}</CustomText>}
          </View>}
        </View>
      </MotionPressable>
      <MotionPressable role="button" accessibilityLabel="Conversation details" disabled={!chat.conversation} onPress={() => router.push({ pathname: "/chat-info", params: { id, sessionId } })} className="h-11 w-11 items-center justify-center rounded-full active:bg-accent"><CustomIcon as={Info} size={22} className="text-foreground" /></MotionPressable>
    </View>}
    {/* WhatsApp's pinned bar: a tap shows the pin in the chat, then steps to the next one. */}
    {shownPin && !selecting && <MotionPressable role="button" onPress={jumpToPin}
      accessibilityLabel={`${pinned.length > 1 ? `Pinned message ${(pinIndex % pinned.length) + 1} of ${pinned.length}` : "Pinned message"}: ${plainWhatsAppText(messageSummary(shownPin))}. Show in chat`}
      className="min-h-12 flex-row items-center gap-3 border-b border-border bg-card px-4 py-2 active:bg-accent">
      {pinned.length > 1 && <View className="gap-0.5">{pinned.map((message, index) => <View key={message.id}
        className={cn("w-0.5 rounded-full", index === pinIndex % pinned.length ? "bg-primary" : "bg-ink-250")} style={{ height: 24 / pinned.length }} />)}</View>}
      <CustomIcon as={Pin} size={16} className="rotate-45 text-ink-600" />
      <View className="min-w-0 flex-1">
        <CustomText className="font-sans-semibold text-xs text-primary">{pinned.length > 1 ? `Pinned message ${(pinIndex % pinned.length) + 1} of ${pinned.length}` : "Pinned message"}</CustomText>
        <CustomText numberOfLines={1} className="text-[13px] text-ink-600">{plainWhatsAppText(messageSummary(shownPin))}</CustomText>
      </View>
    </MotionPressable>}
    <View className="flex-1">
    <ChatWallpaper />
    {!chat.valid ? <InboxState icon={MessageCircle} title="Choose this chat's number" description="This conversation belongs to a different WhatsApp number." action="Choose number" onAction={() => router.push("/connections")} />
      : <View className="flex-1">
        {chat.loading ? <ThreadSkeleton /> : <>
        {chat.error && <View className="gap-1 bg-card p-4"><CustomAlert tone="error">{chat.error}</CustomAlert><CustomButton variant="link" onPress={() => void chat.refresh()}>Try again</CustomButton></View>}
        <FlatList ref={list} data={chat.messages} inverted keyExtractor={(message) => message.id} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 12 }}
          onScroll={onScroll} scrollEventThrottle={64} renderItem={renderItem} extraData={[selected, flashId]}
          // A pin far up the thread isn't measured yet: get near it, then try again.
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
            setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }), 250);
          }}
          // Inverted: the header sits under the newest message.
          ListHeaderComponent={live?.customer ? <TypingBubble activity={live.customer} /> : null}
          ListFooterComponent={chat.more ? <CustomButton size="sm" variant="ghost" className="my-2 self-center" onPress={() => void chat.loadOlder()}>Load earlier messages</CustomButton> : null} />
        {/* An empty chat's welcome sits over the wallpaper, outside the inverted list: the list flips its
            content (differently on Android), which mirrored this text when it lived inside. */}
        {!chat.messages.length && !chat.error && <View pointerEvents="box-none" className="absolute inset-0 items-center justify-center gap-3 px-8 py-10">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm shadow-black/5"><CustomIcon as={Hand} size={28} strokeWidth={1.6} className="text-primary" /></View>
          <CustomText className="text-center font-sans-semibold text-lg">Say hello to {name}</CustomText>
          <CustomText className="text-center text-sm leading-5 text-muted-foreground">{activeNumber ? `Messages are sent from ${numberName(activeNumber)}.` : "Start the conversation with a message."}</CustomText>
          {allowed && <View className="mt-1 w-full gap-2">
            {QUICK_STARTS.map((starter) => <MotionPressable key={starter} role="button" accessibilityLabel={`Use reply: ${starter}`} onPress={() => composer.current?.setDraft(starter)}
              className="min-h-11 justify-center rounded-2xl border border-border bg-card px-4 py-2.5 active:bg-accent">
              <CustomText className="text-center text-sm text-foreground">{starter}</CustomText>
            </MotionPressable>)}
          </View>}
          </View>}
        {showJump && <Animated.View entering={JUMP_IN} exiting={JUMP_OUT} style={{ position: "absolute", right: 16, bottom: 12 }}>
          <MotionPressable role="button" accessibilityLabel="Jump to latest message" onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
            className="h-11 w-11 items-center justify-center rounded-full bg-card shadow-md shadow-black/15">
            <CustomIcon as={ChevronDown} size={22} className="text-foreground" />
          </MotionPressable>
        </Animated.View>}
        </>}
      </View>}
    {chat.valid && chat.conversation && activeNumber && state !== "connected" ? <View className="px-3 pb-3 pt-1">
      <ReconnectDock number={activeNumber} context="thread" />
    </View> : chat.valid && chat.conversation && <View className="gap-2 px-2 pb-2.5 pt-1">
      {!canNote && <CustomText className="self-start rounded-md bg-card px-2 py-1 text-xs leading-5 text-warning-fg">Sending is currently unavailable for this conversation.</CustomText>}
      {!allowed && canNote && <CustomText className="self-start rounded-md bg-card px-2 py-1 text-xs leading-5 text-ink-600">Replies are off in this chat, so you can add private notes only.</CustomText>}
      {sendError && <CustomAlert tone="error" onDismiss={() => setSendError(null)}>{sendError}</CustomAlert>}
      {notice && <View role={notice.error ? "alert" : "status"} className={cn("self-center rounded-full px-3 py-1.5 shadow-sm shadow-black/10", notice.error ? "bg-error-bg" : "bg-ink-900")}>
        <CustomText className={cn("text-xs", notice.error ? "text-error-fg" : "text-white")}>{notice.text}</CustomText>
      </View>}
      {/* "+" on the reaction row: the whole emoji list takes the composer's place until one is picked. */}
      {reactMore && single ? <EmojiPanel label="Reactions" onPick={(emoji) => { void react(single, emoji); clearSelection(); }} />
        : <ChatComposer ref={composer} conversationId={id} conversation={chat.conversation} canReply={allowed} canNote={canNote} onSend={send}
          replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />}
    </View>}
    </View>
  </KeyboardScreen>;
}

/** One of the action bar's icon buttons, labelled for screen readers. */
function ActionButton({ label, icon, onPress }: { label: string; icon: LucideIcon; onPress: () => void }) {
  return <MotionPressable role="button" accessibilityLabel={label} onPress={onPress} className="h-11 w-11 items-center justify-center rounded-full active:bg-accent">
    <CustomIcon as={icon} size={21} className="text-foreground" />
  </MotionPressable>;
}
