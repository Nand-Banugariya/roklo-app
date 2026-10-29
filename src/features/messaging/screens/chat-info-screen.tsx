import { router, useLocalSearchParams } from "expo-router";
import { ArrowUpRight, ChevronDown, MessagesSquare, StickyNote } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "../components/chat-avatar";
import { InboxSkeleton } from "../components/inbox-state";
import { useMessaging } from "../providers/messaging-provider";
import { useAppStore } from "@/store/hooks";
import { selectThread } from "../store/messaging-selectors";
import {
  numberName,
  numberPhone,
  numberSharedWith,
  type ChatMessage,
  type Conversation,
} from "../types";
import { chatTime } from "../utils/chat-dates";
import { renderWhatsAppText } from "../utils/whatsapp-text";

/** Notes shown before "View all", as on the web contact panel. */
const NOTES_PREVIEW = 3;
const isNote = (message: ChatMessage) =>
  message.type === "PRIVATE_NOTE" && !message.isRevoked && !message.id.startsWith("local-");
/** Newest first. */
const notesOf = (messages: ChatMessage[]) =>
  messages.filter(isNote).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * Contact or group details, as the web inbox's contact panel: who it is, the number it's on, its labels and its
 * private notes, newest first. A note's arrow goes back to the chat and highlights it there.
 */
export function ChatInfoScreen() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const { api, activeNumber } = useMessaging();
  const [chat, setChat] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The chat's loaded messages (kept in the `messaging` slice), as the web panel uses; a chat not kept
  // reads its latest page.
  const store = useAppStore();
  const [cached] = useState(() => {
    const thread = selectThread(store.getState(), id);
    return thread?.conversation.sessionId === sessionId ? notesOf(thread.messages) : null;
  });
  const [notes, setNotes] = useState<ChatMessage[]>(cached ?? []);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!activeNumber || activeNumber.id !== sessionId) return;
    const controller = new AbortController();
    void api.conversation(id, sessionId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setError(result.message || "Couldn't load conversation details.");
        return;
      }
      const row = result.data.data.find((item) => item.id === id && item.sessionId === sessionId);
      if (!row) setError("This conversation is no longer available.");
      else setChat(row);
    });
    if (!cached)
      void api.messages(id, null, controller.signal).then((result) => {
        if (!controller.signal.aborted && result.ok) setNotes(notesOf(result.data.data));
      });
    // Note authors by name; a failed lookup only shows "Teammate".
    void api.members(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) return;
      setMembers(
        new Map(
          result.data.flatMap((member) =>
            member.user?.name ? [[member.user.id, member.user.name] as const] : [],
          ),
        ),
      );
    });
    return () => controller.abort();
  }, [api, id, sessionId, activeNumber, cached]);

  const name = chat
    ? chat.name ||
      (chat.mobileNumber ? numberPhone({ phoneNumber: chat.mobileNumber }) : "Unknown contact")
    : "";
  const shown = showAll ? notes : notes.slice(0, NOTES_PREVIEW);
  const viaName = activeNumber ? numberName(activeNumber) : null;
  const viaPhone = activeNumber?.phoneNumber ? numberPhone(activeNumber) : null;
  return (
    <View className="flex-1 bg-card">
      <ScreenHeader title={chat?.isGroup ? "Group info" : "Contact info"} />
      {error ? (
        <View className="p-5">
          <CustomAlert tone="error">{error}</CustomAlert>
        </View>
      ) : !chat ? (
        <InboxSkeleton />
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          <View className="items-center gap-2 border-b border-border px-5 py-6">
            <ChatAvatar conversationId={chat.id} name={name} size={80} />
            <CustomText selectable className="text-center font-sans-semibold text-lg">
              {name}
            </CustomText>
            {chat.isGroup ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-info-tint px-2.5 py-1">
                <CustomIcon as={MessagesSquare} size={12} className="text-info-fg" />
                <CustomText className="font-sans-medium text-xs text-info-fg">
                  WhatsApp group{chat.memberCount ? ` · ${chat.memberCount} members` : ""}
                </CustomText>
              </View>
            ) : (
              chat.mobileNumber && (
                <CustomText selectable className="font-mono text-sm text-muted-foreground">
                  {numberPhone({ phoneNumber: chat.mobileNumber })}
                </CustomText>
              )
            )}
          </View>

          <View className="gap-3 border-b border-border px-5 py-4">
            <Row label={chat.isGroup ? "Joined via" : "Chats on"}>
              {viaName ? (
                <CustomText
                  numberOfLines={1}
                  className="min-w-0 shrink text-right font-sans-medium text-sm"
                >
                  {viaName}
                  {viaPhone && viaPhone !== viaName ? (
                    <CustomText className="font-mono text-xs text-muted-foreground">
                      {" "}
                      · {viaPhone}
                    </CustomText>
                  ) : null}
                </CustomText>
              ) : (
                <CustomText className="text-sm">—</CustomText>
              )}
            </Row>
            {activeNumber && (
              <Row label="Visible to">
                <CustomText
                  numberOfLines={2}
                  className="min-w-0 shrink text-right font-sans-medium text-sm"
                >
                  {numberSharedWith(activeNumber)}
                </CustomText>
              </Row>
            )}
            {chat.lastMessageAt && (
              <Row label="Last message">
                <CustomText className="font-sans-medium text-sm">
                  {chatTime(chat.lastMessageAt)}
                </CustomText>
              </Row>
            )}
          </View>

          {!!chat.labels?.length && (
            <View className="gap-2 border-b border-border px-5 py-4">
              <CustomText className="font-sans-semibold text-xs text-muted-foreground">
                Labels
              </CustomText>
              <View className="flex-row flex-wrap gap-1.5">
                {chat.labels.map((label) => (
                  <View
                    key={label.id}
                    className="flex-row items-center gap-1.5 rounded-full bg-accent py-1 pl-2 pr-2.5"
                  >
                    <View
                      className={cn("h-2 w-2 rounded-full", !label.color && "bg-muted-foreground")}
                      style={label.color ? { backgroundColor: label.color } : undefined}
                    />
                    <CustomText className="font-sans-medium text-xs">{label.name}</CustomText>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className="gap-2.5 px-5 pt-4">
            <View className="flex-row items-center gap-1.5">
              <CustomIcon as={StickyNote} size={13} className="text-muted-foreground" />
              <CustomText className="flex-1 font-sans-semibold text-xs text-muted-foreground">
                Private notes
              </CustomText>
              <CustomText className="font-sans-medium text-xs text-muted-foreground">
                {notes.length}
              </CustomText>
            </View>
            {shown.length ? (
              shown.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  by={note.createdById ? (members.get(note.createdById) ?? "Teammate") : "Teammate"}
                  onGoToChat={() =>
                    router.dismissTo({
                      pathname: "/chat/[id]",
                      params: { id, sessionId, messageId: note.id },
                    })
                  }
                />
              ))
            ) : (
              <View className="rounded-lg border border-dashed border-border px-3 py-3.5">
                <CustomText className="text-center text-sm text-muted-foreground">
                  No private notes on this chat yet.
                </CustomText>
              </View>
            )}
            {notes.length > NOTES_PREVIEW && (
              <CustomButton
                variant="ghost"
                size="sm"
                fullWidth
                accessibilityState={{ expanded: showAll }}
                trailingIcon={
                  <CustomIcon
                    as={ChevronDown}
                    size={16}
                    className={cn("text-foreground", showAll && "rotate-180")}
                  />
                }
                onPress={() => setShowAll((open) => !open)}
              >
                {showAll ? "View less" : `View all ${notes.length} notes`}
              </CustomButton>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <CustomText className="shrink-0 text-sm text-muted-foreground">{label}</CustomText>
      <View className="min-w-0 flex-1 flex-row justify-end">{children}</View>
    </View>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

/** One private note: three lines at first, with "Read more" only when the text runs past them. */
function NoteCard({
  note,
  by,
  onGoToChat,
}: {
  note: ChatMessage;
  by: string;
  onGoToChat: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const body = note.body
    ? renderWhatsAppText(note.body, { participants: note.mentionedParticipants })
    : null;
  return (
    <View className="gap-1.5 rounded-lg border border-note-border bg-note-bg px-3 py-2.5">
      <View className="flex-row items-center gap-1.5">
        <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-note-border">
          <CustomText className="font-sans-semibold text-[8px] text-warning-fg">
            {initials(by)}
          </CustomText>
        </View>
        <CustomText
          numberOfLines={1}
          className="min-w-0 flex-1 font-sans-medium text-xs text-warning-fg"
        >
          {by}
        </CustomText>
        <CustomText className="text-xs text-warning-fg opacity-75">
          {chatTime(note.createdAt)}
        </CustomText>
        <MotionPressable
          role="button"
          accessibilityLabel="Go to chat"
          accessibilityHint="Shows this note in the chat"
          onPress={onGoToChat}
          hitSlop={8}
          className="-my-1 -mr-1 h-7 w-7 items-center justify-center rounded-md active:bg-note-border"
        >
          <CustomIcon as={ArrowUpRight} size={16} className="text-warning-fg" />
        </MotionPressable>
      </View>
      {/* Measured unclamped, out of sight, to know whether "Read more" is needed. */}
      {!!body && !expanded && (
        <View
          pointerEvents="none"
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          className="absolute left-3 right-3 top-0 opacity-0"
        >
          <CustomText
            onTextLayout={({ nativeEvent }) => setLong(nativeEvent.lines.length > 3)}
            className="text-[13px] leading-[19px]"
          >
            {body}
          </CustomText>
        </View>
      )}
      {!!body && (
        <CustomText
          selectable
          numberOfLines={expanded ? undefined : 3}
          className="text-[13px] leading-[19px] text-note-fg"
        >
          {body}
        </CustomText>
      )}
      {long && (
        <MotionPressable
          role="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((open) => !open)}
          hitSlop={6}
          className="self-start"
        >
          <CustomText className="font-sans-medium text-[13px] text-warning-fg">
            {expanded ? "Show less" : "Read more"}
          </CustomText>
        </MotionPressable>
      )}
    </View>
  );
}
