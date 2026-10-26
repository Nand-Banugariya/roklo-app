import { Ban, ChartBar, Check, CheckCheck, CircleAlert, Clock3, Contact, FileText, Image as ImageIcon, Lock, Mic, Pin, Reply, Video } from "lucide-react-native";
import { Image } from "expo-image";
import { memo, useEffect, useRef } from "react";
import { View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { Pressable } from "@/components/ui/pressable";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { numberPhone, type ChatMessage } from "../types";
import { attachmentKind, attachmentName } from "../utils/attachments";
import { clockTime } from "../utils/chat-dates";
import { plainWhatsAppText, renderWhatsAppText } from "../utils/whatsapp-text";
import { MessageMedia } from "./message-media";

const ENTER = FadeIn.duration(200).reduceMotion(ReduceMotion.System);
const SENDER_COLORS = ["sender-1", "sender-2", "sender-3", "sender-4", "sender-5"] as const;
const QUOTE_LABEL = { POLL: "Poll", CONTACT_CARD: "Contact card", VOICE: "Voice message" } as const;

/** A group member's name colour, picked by the name's character sum as on the web app. */
function senderToken(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return SENDER_COLORS[sum % SENDER_COLORS.length];
}

/**
 * One message, laid out like WhatsApp: the group sender's name, the quoted message, photos and videos
 * edge to edge (the time over the photo when there's no caption), audio, documents, contact cards and
 * polls, the formatted text, then time, "Edited" and ticks. Reactions hang off the bottom edge.
 * `first` starts a run from the same side (tail + breathing room); `fresh` fades in a message the user just sent.
 */
export const MessageBubble = memo(function MessageBubble({ message, first = true, fresh, isGroup, selected, selecting, myUserId, onSelect, onReply, onReact, onQuotePress, flash }: {
  message: ChatMessage; first?: boolean; fresh?: boolean; isGroup?: boolean;
  /** WhatsApp's long-press selection: this message is picked, and whether any message is. */
  selected?: boolean; selecting?: boolean;
  /** The signed-in teammate, to mark their own reaction. */
  myUserId?: string;
  /** Long press, or a tap while selecting: picks or drops this message. */
  onSelect?: () => void;
  /** Swipe right to reply, as on WhatsApp. Unset: no swipe. */
  onReply?: () => void;
  /** Tapping a reaction chip reacts with it (your own again removes it). Unset: chips are read-only. */
  onReact?: (emoji: string) => void;
  /** Tapping the quote jumps to the message it quotes, as on WhatsApp: its id as the reply and the quote carry it. */
  onQuotePress?: (messageIds: string[]) => void;
  /** This is the message just jumped to: it flashes once. */
  flash?: boolean;
}) {
  const { colors } = useRokloTheme();
  const swipe = useRef<SwipeableMethods>(null);
  if (message.type === "SYSTEM") {
    return <View className="my-2 max-w-[85%] self-center rounded-xl border border-bubble-system-border bg-card px-3 py-1.5">
      <CustomText className="text-center text-xs leading-[18px] text-muted-foreground">{message.body || "Conversation update"}</CustomText>
    </View>;
  }
  const outgoing = message.direction === "OUTBOUND";
  const note = message.type === "PRIVATE_NOTE";
  const status = message.deliveryStatus;
  const failed = outgoing && !note && status === "FAILED";
  const files = message.isRevoked ? [] : message.files ?? [];
  const visual = files.filter((url, index) => ["image", "video"].includes(attachmentKind(url, message.fileNames?.[index])));
  const body = message.isRevoked ? null : message.body?.trim() || null;
  // A photo with no caption carries its time over the photo, as on WhatsApp.
  const mediaOnly = !body && visual.length > 0 && visual.length === files.length && !message.replyToPreview;
  // A group member's message: their initials beside the first of a run, and their name in its colour with
  // the number beside it (the web app's sender line); the number alone when WhatsApp has no name for them.
  const groupMember = !!isGroup && !outgoing && !note;
  const memberNumber = message.sender?.mobileNumber ?? message.senderMobileNumber ?? null;
  const memberPhone = memberNumber ? numberPhone({ phoneNumber: memberNumber.split("@")[0] }) : null;
  const memberName = message.sender?.name?.trim() || memberPhone || "Member";
  const senderName = groupMember && first ? memberName : null;
  const reactions = !note && !message.isRevoked ? groupReactions(message.reactions ?? []) : [];
  const mine = myUserId ? message.reactions?.find((reaction) => reaction.reactorUserId === myUserId)?.emoji : undefined;

  const meta = <View className={cn("flex-row items-center justify-end gap-1", mediaOnly && "rounded-full bg-black/45 px-1.5 py-0.5")}>
    {message.isPinned && <CustomIcon as={Pin} size={11} className={cn("rotate-45", mediaOnly ? "text-white" : "text-bubble-meta")} />}
    {!!message.editedAt && !message.isRevoked && <CustomText className={cn("text-[11px]", mediaOnly ? "text-white" : "text-bubble-meta")}>Edited</CustomText>}
    <CustomText className={cn("text-[11px]", mediaOnly ? "text-white" : "text-bubble-meta")}>{clockTime(message.createdAt)}</CustomText>
    {outgoing && !note && !failed && <View accessibilityLabel={status.toLowerCase()}>
      <CustomIcon as={status === "QUEUED" ? Clock3 : ["DELIVERED", "READ"].includes(status) ? CheckCheck : Check}
        size={15} strokeWidth={2.2} className={status === "READ" ? "text-tick-read" : mediaOnly ? "text-white" : "text-bubble-meta"} />
    </View>}
  </View>;

  const column = <>
    <View className={cn(groupMember ? "max-w-[88%]" : "max-w-[82%]", "gap-1 rounded-2xl",
      files.length ? "p-1" : "px-3 pb-1.5 pt-2",
      outgoing ? "self-end bg-bubble-out" : "self-start bg-bubble-in shadow-sm shadow-black/5",
      first && (outgoing ? "rounded-tr-[4px]" : "rounded-tl-[4px]"),
      note && "border border-note-border bg-note-bg",
      failed && "border border-error-border")}>
      {(note || senderName) && <View className={cn(files.length > 0 && "px-2 pt-1")}>
        {note && <View className="flex-row items-center gap-1">
          <CustomIcon as={Lock} size={11} className="text-note-fg" />
          <CustomText className="font-sans-semibold text-[10px] tracking-wide text-note-fg">PRIVATE NOTE · TEAM ONLY</CustomText>
        </View>}
        {senderName && <View className="flex-row items-baseline gap-1.5">
          <CustomText numberOfLines={1} className="shrink font-sans-semibold text-[13px]" style={{ color: colors[senderToken(senderName)] }}>{senderName}</CustomText>
          {!!message.sender?.name?.trim() && !!memberPhone && <CustomText numberOfLines={1} className="shrink-0 text-[11px] text-ink-400">{memberPhone}</CustomText>}
        </View>}
      </View>}
      {message.isRevoked ? <View className="flex-row items-center gap-1.5">
        <CustomIcon as={Ban} size={14} className="text-muted-foreground" />
        <CustomText className="text-[15px] italic leading-[22px] text-muted-foreground">This message was deleted</CustomText>
      </View> : <>
        {message.replyToPreview && (onQuotePress && !selecting
          ? <Pressable role="button" accessibilityLabel="Show the quoted message" onPress={() => onQuotePress([...new Set([message.replyToMessageId, message.replyToPreview?.id].filter((value): value is string => !!value))])}
            onLongPress={onSelect} delayLongPress={350} className="rounded-lg active:opacity-80"><Quote preview={message.replyToPreview} /></Pressable>
          : <Quote preview={message.replyToPreview} />)}
        <RichContent message={message} />
        {files.length > 0 && <MessageMedia messageId={message.id} files={files} names={message.fileNames ?? []}
          voice={message.contentType === "VOICE"} outgoing={outgoing} overlay={mediaOnly ? meta : undefined} onLongPress={onSelect} />}
        {body && <CustomText className={cn("text-[15px] leading-[22px] text-foreground", files.length > 0 && "px-2 pt-0.5")}>
          {renderWhatsAppText(body)}
        </CustomText>}
        {!body && !files.length && !message.richContent && <CustomText className="text-[15px] leading-[22px] text-muted-foreground">Message</CustomText>}
      </>}
      {!mediaOnly && <View className={cn(files.length > 0 && "px-2 pb-0.5")}>{meta}</View>}
    </View>
    {reactions.length > 0 && <View accessibilityLabel={`Reactions: ${reactions.map((reaction) => `${reaction.emoji} ${reaction.count}`).join(", ")}`}
      className={cn("-mt-2.5 flex-row gap-1", outgoing ? "mr-3 self-end" : "ml-3 self-start")}>
      {reactions.map((reaction) => <Pressable key={reaction.emoji} role="button" disabled={!onReact || selecting}
        accessibilityLabel={`${reaction.emoji} ${reaction.count}${mine === reaction.emoji ? ", including you. Remove" : ". React"}`}
        onPress={() => onReact?.(reaction.emoji)}
        className={cn("min-h-6 flex-row items-center gap-0.5 rounded-full border px-1.5 shadow-sm shadow-black/10",
          mine === reaction.emoji ? "border-brand-300 bg-brand-50" : "border-card bg-card")}>
        <CustomText className="text-[13px]">{reaction.emoji}</CustomText>
        {reaction.count > 1 && <CustomText className="font-sans-medium text-[11px] text-muted-foreground">{reaction.count}</CustomText>}
      </Pressable>)}
    </View>}
    {failed && <View role="alert" className="mt-1 max-w-[82%] flex-row items-center gap-1 self-end">
      <CustomIcon as={CircleAlert} size={13} className="text-error-fg" />
      <CustomText numberOfLines={2} className="shrink font-sans-medium text-[11px] text-error-fg">Not sent{message.failureReason ? ` · ${message.failureReason}` : ""}</CustomText>
    </View>}
  </>;
  const spacing = cn(first ? "mt-2" : "mt-0.5", reactions.length > 0 && "mb-3");
  // In a group, WhatsApp lines a member's run up beside their avatar; later messages keep its space.
  const content = groupMember
    ? <View className={cn("flex-row items-start gap-1.5 pl-2 pr-3", spacing)}>
      <View className="w-8" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {first && <CustomAvatar name={memberName} size={32} colorful />}
      </View>
      <View className="min-w-0 flex-1 items-start">{column}</View>
    </View>
    : <View className={cn("px-3", spacing)}>{column}</View>;
  // Long press picks the message (WhatsApp); while picking, a tap anywhere on the row toggles it,
  // above the media and links inside. The row tints while picked.
  const row = <View>
    {selected && <View pointerEvents="none" className="absolute inset-0 bg-primary opacity-15" />}
    {flash !== undefined && !selected && <Flash active={flash} />}
    <Pressable onLongPress={onSelect} delayLongPress={350} disabled={!onSelect} accessibilityHint={selecting ? undefined : "Long press for message options"}
      accessibilityState={{ selected: !!selected }}>{content}</Pressable>
    {selecting && <Pressable role="button" accessibilityLabel={selected ? "Unselect message" : "Select message"} onPress={onSelect} className="absolute inset-0" />}
  </View>;
  // Swipe right to reply; the reply arrow fades in under the bubble as it moves.
  const swipeable = onReply && !selecting ? <ReanimatedSwipeable ref={swipe} friction={2} leftThreshold={64} overshootLeft={false}
    renderLeftActions={(_, translation) => <ReplyHint translation={translation} />}
    onSwipeableWillOpen={() => { onReply(); swipe.current?.close(); }}>{row}</ReanimatedSwipeable> : row;
  // Style-only Animated wrapper: Reanimated never receives NativeWind class names.
  return fresh ? <Animated.View entering={ENTER}>{swipeable}</Animated.View> : swipeable;
});

/**
 * The web app's mark on a message reached from its quote or a pin (bg-highlight/50 with a 500 ms
 * colour transition): the row turns yellow, holds while it's the focus, then fades out.
 */
function Flash({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(active ? 0.5 : 0, { duration: reduced ? 0 : 500 });
  }, [active, opacity, reduced]);
  const { colors } = useRokloTheme();
  // Style only: Reanimated never receives NativeWind class names.
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.highlight }, style]} />;
}

function ReplyHint({ translation }: { translation: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, translation.value / 64), transform: [{ scale: 0.6 + Math.min(0.4, translation.value / 160) }] }));
  return <View className="w-16 items-center justify-center">
    <Animated.View style={style}>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-card shadow-sm shadow-black/10">
        <CustomIcon as={Reply} size={16} className="text-ink-600" />
      </View>
    </Animated.View>
  </View>;
}

function groupReactions(reactions: NonNullable<ChatMessage["reactions"]>) {
  const counts = new Map<string, number>();
  for (const reaction of reactions) counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

/** What a reply quotes: its text, or a quoted photo as a thumbnail, else "Video" / the file's name. */
function Quote({ preview }: { preview: NonNullable<ChatMessage["replyToPreview"]> }) {
  const first = preview.files?.[0];
  const kind = first ? attachmentKind(first, preview.fileNames?.[0]) : null;
  const label = (preview.contentType && preview.contentType in QUOTE_LABEL ? QUOTE_LABEL[preview.contentType as keyof typeof QUOTE_LABEL] : null)
    ?? (kind === "image" ? "Photo" : kind === "video" ? "Video" : kind === "audio" ? "Audio" : first ? attachmentName(first, preview.fileNames?.[0]) : "Message");
  const icon = preview.contentType === "VOICE" ? Mic : kind === "image" ? ImageIcon : kind === "video" ? Video : first ? FileText : null;
  return <View className="flex-row items-center gap-2 overflow-hidden rounded-lg border-l-[3px] border-primary bg-black/5 py-1.5 pl-2 pr-1.5">
    <View className="min-w-0 flex-1">
      {preview.body ? <CustomText numberOfLines={3} className="text-[13px] leading-[18px] text-ink-600">{plainWhatsAppText(preview.body)}</CustomText>
        : <View className="flex-row items-center gap-1.5">
          {icon && <CustomIcon as={icon} size={13} className="text-ink-600" />}
          <CustomText numberOfLines={1} className="shrink text-[13px] text-ink-600">{label}</CustomText>
        </View>}
    </View>
    {kind === "image" && first && <Image source={{ uri: first }} style={{ width: 40, height: 40, borderRadius: 6 }} contentFit="cover" />}
  </View>;
}

/** Contact cards and polls, from `richContent` (the web app's RichContent). */
function RichContent({ message }: { message: ChatMessage }) {
  const rich = (message.richContent ?? {}) as Record<string, unknown>;
  if (message.contentType === "CONTACT_CARD") {
    const vcard = Array.isArray(rich.vCards) ? String(rich.vCards[0] ?? "") : "";
    const name = typeof rich.fullName === "string" ? rich.fullName : (vcard.match(/^FN:(.*)$/m)?.[1] ?? "Contact");
    const phone = typeof rich.phoneNumber === "string" ? rich.phoneNumber : (vcard.match(/TEL[^:]*:(.*)$/m)?.[1] ?? "");
    return <View className="min-w-[200px] flex-row items-center gap-2.5 rounded-lg bg-black/5 px-2.5 py-2">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-success-bg"><CustomIcon as={Contact} size={16} className="text-success-fg" /></View>
      <View className="min-w-0 flex-1">
        <CustomText numberOfLines={1} className="font-sans-semibold text-sm">{name}</CustomText>
        {!!phone && <CustomText className="font-mono text-xs text-ink-600">{numberPhone({ phoneNumber: phone.replace(/[^\d+]/g, "") })}</CustomText>}
      </View>
    </View>;
  }
  if (message.contentType === "POLL") {
    const options = Array.isArray(rich.options) ? rich.options.map(String) : [];
    return <View className="min-w-[200px] gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <CustomIcon as={ChartBar} size={14} className="text-foreground" />
        <CustomText className="shrink font-sans-semibold text-[15px]">{String(rich.question ?? "Poll")}</CustomText>
      </View>
      {options.map((option) => <View key={option} className="rounded-lg border border-black/10 px-2.5 py-1.5">
        <CustomText className="text-[13px]">{option}</CustomText>
      </View>)}
    </View>;
  }
  return null;
}

export function DaySeparator({ label }: { label: string }) {
  return <View className="my-3 self-center rounded-full bg-card px-3 py-1 shadow-sm shadow-black/5">
    <CustomText className="font-sans-medium text-[11px] text-muted-foreground">{label}</CustomText>
  </View>;
}
