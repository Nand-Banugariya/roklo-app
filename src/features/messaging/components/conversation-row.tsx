import { BellOff, Check, Pin, Users } from "lucide-react-native";
import { memo } from "react";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { typingLabel, useChatTyping } from "../providers/typing-provider";
import { ChatAvatar } from "./chat-avatar";
import type { Conversation } from "../types";
import { plainWhatsAppText } from "../utils/whatsapp-text";
import { chatTime } from "../utils/chat-dates";

/** WhatsApp's chat-list proportions: 72px rows, a 48px photo with 12px above and below, text 16px after it. */
export const ConversationRow = memo(function ConversationRow({
  conversation: row,
  selected,
  selecting,
  onPress,
  onLongPress,
}: {
  conversation: Conversation;
  /** WhatsApp's long-press selection: this chat is picked, and whether any chat is. */
  selected?: boolean;
  selecting?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const unread = row.unreadCount > 0;
  const name = row.name || row.mobileNumber || "Unknown contact";
  const typing = typingLabel(useChatTyping(row));
  const preview = row.lastMessagePreview
    ? plainWhatsAppText(row.lastMessagePreview, row.lastMessageMentionedParticipants)
    : null;
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={`${name}, ${typing || preview || "No messages yet"}${unread ? `, ${row.unreadCount} unread` : ""}`}
      accessibilityState={selecting ? { selected: !!selected } : undefined}
      accessibilityHint={selecting ? undefined : "Long press to select"}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="min-h-[72px] flex-row items-center gap-4 px-5 py-3 active:bg-accent"
    >
      {selected && <View pointerEvents="none" className="absolute inset-0 bg-primary opacity-15" />}
      <View>
        <ChatAvatar conversationId={row.id} name={name} size={48} />
        {selected ? (
          <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary">
            <CustomIcon as={Check} size={11} strokeWidth={3} className="text-primary-foreground" />
          </View>
        ) : (
          row.isGroup && (
            <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-foreground">
              <CustomIcon as={Users} size={10} className="text-background" />
            </View>
          )
        )}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-3">
          <CustomText numberOfLines={1} className="flex-1 font-sans-semibold text-base">
            {name}
          </CustomText>
          <CustomText
            className={cn(
              "text-xs",
              unread && !row.isMuted ? "font-sans-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {chatTime(row.lastMessageAt)}
          </CustomText>
        </View>
        <View className="flex-row items-center gap-1.5">
          {/* WhatsApp swaps the preview for the live "typing…" line, in green. */}
          <CustomText
            numberOfLines={1}
            className={cn(
              "flex-1 text-sm",
              typing
                ? "font-sans-medium text-primary"
                : unread
                  ? "font-sans-medium text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {typing || preview || "Start the conversation"}
          </CustomText>
          {row.isMuted && <CustomIcon as={BellOff} size={14} className="text-muted-foreground" />}
          {row.isPinned && (
            <CustomIcon as={Pin} size={14} className="rotate-45 text-muted-foreground" />
          )}
          {unread && (
            <View
              className={cn(
                "h-5 min-w-5 items-center justify-center rounded-full px-1.5",
                row.isMuted ? "bg-muted-foreground" : "bg-primary",
              )}
            >
              <CustomText className="font-sans-bold text-[11px] text-primary-foreground">
                {row.unreadCount > 99 ? "99+" : row.unreadCount}
              </CustomText>
            </View>
          )}
        </View>
        {!!row.labels?.length && (
          <View className="mt-0.5 flex-row items-center gap-1.5">
            {row.labels.slice(0, 2).map((label) => (
              <View
                key={label.id}
                className="max-w-[140px] flex-row items-center gap-1 rounded-full bg-accent py-0.5 pl-1.5 pr-2"
              >
                <View
                  className={cn("h-1.5 w-1.5 rounded-full", !label.color && "bg-muted-foreground")}
                  style={label.color ? { backgroundColor: label.color } : undefined}
                />
                <CustomText
                  numberOfLines={1}
                  className="font-sans-medium text-[10px] text-muted-foreground"
                >
                  {label.name}
                </CustomText>
              </View>
            ))}
            {row.labels.length > 2 && (
              <CustomText className="text-[10px] text-muted-foreground">
                +{row.labels.length - 2}
              </CustomText>
            )}
          </View>
        )}
      </View>
    </MotionPressable>
  );
});
