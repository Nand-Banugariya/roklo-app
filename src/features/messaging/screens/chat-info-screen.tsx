import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { ChatAvatar } from "../components/chat-avatar";
import { InboxSkeleton } from "../components/inbox-state";
import { useMessaging } from "../providers/messaging-provider";
import { numberName, type Conversation } from "../types";

export function ChatInfoScreen() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const { api, activeNumber } = useMessaging();
  const [chat, setChat] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!activeNumber || activeNumber.id !== sessionId) return;
    const controller = new AbortController();
    void api.conversation(id, sessionId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok) { setError(result.message || "Couldn't load conversation details."); return; }
      const row = result.data.data.find((item) => item.id === id && item.sessionId === sessionId);
      if (!row) setError("This conversation is no longer available."); else setChat(row);
    });
    return () => controller.abort();
  }, [api, id, sessionId, activeNumber]);
  return <View className="flex-1 bg-card"><ScreenHeader title="Conversation details" />
    {error ? <View className="p-5"><CustomAlert tone="error">{error}</CustomAlert></View> : !chat ? <InboxSkeleton /> : <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="items-center gap-3 py-4"><ChatAvatar conversationId={chat.id} name={chat.name} size={80} /><CustomText className="font-sans-semibold text-2xl">{chat.name}</CustomText>
        {chat.mobileNumber && <CustomText selectable className="text-sm text-muted-foreground">{chat.mobileNumber}</CustomText>}</View>
      <View className="gap-2 border-t border-border pt-5"><CustomText className="font-sans-semibold text-sm">WhatsApp number</CustomText><CustomText className="text-sm text-muted-foreground">{activeNumber ? numberName(activeNumber) : "Number unavailable"}</CustomText></View>
      <View className="gap-3"><CustomText className="font-sans-semibold text-sm">Tags</CustomText>
        {chat.labels?.length ? <View className="flex-row flex-wrap gap-2">{chat.labels.map((tag) => <View key={tag.id} className="rounded-full bg-accent px-3 py-2"><CustomText className="text-sm text-primary">{tag.name}</CustomText></View>)}</View>
          : <CustomText className="text-sm text-muted-foreground">No tags added</CustomText>}</View>
    </ScrollView>}
  </View>;
}
