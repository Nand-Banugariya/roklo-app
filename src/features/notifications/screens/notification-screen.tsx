import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { InboxSkeleton } from "@/features/messaging/components/inbox-state";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { loadWorkspaces, switchWorkspace } from "@/features/workspaces/services/workspace-service";
import { session } from "@/services/storage/session";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { notificationApi } from "../services/notification-service";
import { notificationTarget } from "../utils/notification-target";

/** A full screen while authenticated workspace and number access are resolved. */
export function NotificationScreen() {
  const params = useLocalSearchParams<{
    workspaceId: string;
    conversationId: string;
    messageId: string;
  }>();
  const target = notificationTarget(params);
  const workspaceId = target?.workspaceId;
  const conversationId = target?.conversationId;
  const messageId = target?.messageId;
  const dispatch = useAppDispatch();
  const workspaces = useAppSelector((state) => state.workspace);
  const { numbers, loading, error: numberError, selectNumber, refreshNumbers } = useMessaging();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const switchAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (
      !workspaceId ||
      !conversationId ||
      !messageId ||
      workspaces.status !== "ready" ||
      workspaces.switchingId
    )
      return;
    const controller = new AbortController();
    const token = session.getToken();
    const valid = () => !controller.signal.aborted && token && session.getToken() === token;
    void (async () => {
      const workspace = workspaces.items.find((item) => item.id === workspaceId);
      if (!workspace || workspace.status === "DISABLED") {
        setError("This workspace is no longer available to your account.");
        return;
      }
      if (workspaces.activeId !== workspaceId) {
        if (switchAttempt.current === workspaceId) {
          setError("Couldn't switch to this message's workspace. Try again.");
          return;
        }
        switchAttempt.current = workspaceId;
        const switched = await dispatch(switchWorkspace(workspaceId));
        if (valid() && !switched)
          setError("Couldn't switch to this message's workspace. Try again.");
        return;
      }
      if (loading || numberError || !token) return;
      const result = await notificationApi.conversation(workspaceId, conversationId, {
        token,
        signal: controller.signal,
      });
      if (!valid()) return;
      if (!result.ok) {
        setError(result.message || "Couldn't open this message. Try again.");
        return;
      }
      const conversation = result.data?.data?.find((item) => item.id === conversationId);
      if (!conversation || !numbers.some((number) => number.id === conversation.sessionId)) {
        setError(
          "This conversation or its WhatsApp number is no longer available to your account.",
        );
        return;
      }
      selectNumber(conversation.sessionId);
      router.replace({
        pathname: "/chat/[id]",
        params: { id: conversationId, sessionId: conversation.sessionId, messageId },
      });
    })().catch(() => {
      if (valid()) setError("Couldn't open this message. Try again.");
    });
    return () => controller.abort();
  }, [
    workspaceId,
    conversationId,
    messageId,
    workspaces.status,
    workspaces.activeId,
    workspaces.items,
    workspaces.switchingId,
    loading,
    numberError,
    numbers,
    selectNumber,
    dispatch,
    attempt,
  ]);

  const failure = !target
    ? "This notification doesn't contain a valid message."
    : error || numberError || workspaces.error;
  return (
    <View className="flex-1 bg-card">
      <ScreenHeader title="Opening message" />
      {failure ? (
        <View className="gap-4 p-5">
          <CustomAlert tone="warning">{failure}</CustomAlert>
          {target && (
            <CustomButton
              onPress={() => {
                switchAttempt.current = null;
                setError(null);
                void dispatch(loadWorkspaces(true));
                void refreshNumbers();
                setAttempt((old) => old + 1);
              }}
            >
              Try again
            </CustomButton>
          )}
          <CustomButton variant="secondary" onPress={() => router.replace("/inbox")}>
            Go to chats
          </CustomButton>
        </View>
      ) : (
        <>
          <CustomText
            accessibilityLiveRegion="polite"
            className="px-5 py-3 text-sm text-muted-foreground"
          >
            Opening the message’s conversation…
          </CustomText>
          <InboxSkeleton />
        </>
      )}
    </View>
  );
}
