import { router } from "expo-router";
import { PauseCircle, RefreshCw, Smartphone, Unplug } from "lucide-react-native";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { connectionState, numberName, type WhatsAppNumber } from "../types";
import { WhatsAppMark } from "./whatsapp-mark";

/** Inverse, thumb-zone dock that owns the reconnect action whenever the active number is not live. */
export function ReconnectDock({
  number,
  context,
  className,
}: {
  number: WhatsAppNumber;
  context: "inbox" | "thread";
  className?: string;
}) {
  const { colors } = useRokloTheme();
  const state = connectionState(number);
  if (state === "connected") return null;
  const name = numberName(number);
  const connecting = state === "connecting";
  const title = connecting
    ? `Reconnecting ${name}…`
    : state === "unlinked"
      ? `${name} isn't linked yet`
      : `${name} isn't connected`;
  const body = connecting
    ? "This usually takes a few seconds."
    : context === "thread"
      ? "Reconnect to reply. Your history stays right here."
      : "Chats are read-only until you reconnect.";
  const action = state === "unlinked" ? "Link" : "Reconnect";
  return (
    <View
      role="alert"
      accessibilityLiveRegion="polite"
      className={cn(
        "min-h-16 flex-row items-center gap-3 rounded-3xl bg-foreground p-2.5 shadow-lg",
        className,
      )}
    >
      <View className="h-11 w-11 items-center justify-center">
        {connecting ? (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
            <CustomSpinner color={colors["on-solid"]} accessibilityLabel="Reconnecting" />
          </View>
        ) : (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-warning-solid">
            <CustomIcon as={Unplug} size={20} className="text-on-solid" />
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <CustomText numberOfLines={2} className="font-sans-semibold text-sm text-background">
          {title}
        </CustomText>
        <CustomText numberOfLines={2} className="text-xs leading-[17px] text-background opacity-70">
          {body}
        </CustomText>
      </View>
      {!connecting && (
        <MotionPressable
          role="button"
          accessibilityLabel={`${action} ${name}`}
          onPress={() =>
            router.push({ pathname: "/connect-number", params: { sessionId: number.id } })
          }
          className="h-11 flex-row items-center gap-1.5 rounded-full bg-primary px-4"
        >
          <CustomIcon as={RefreshCw} size={15} className="text-primary-foreground" />
          <CustomText className="font-sans-semibold text-[13px] text-primary-foreground">
            {action}
          </CustomText>
        </MotionPressable>
      )}
    </View>
  );
}

/** Sits above synced chats while the number is offline, so the list reads as paused rather than broken. */
export function PausedListHeader() {
  return (
    <View className="flex-row items-center gap-3 px-5 pb-1 pt-2">
      <View className="h-px flex-1 bg-border" />
      <View className="flex-row items-center gap-1.5 rounded-full bg-accent px-3 py-1.5">
        <CustomIcon as={PauseCircle} size={13} className="text-muted-foreground" />
        <CustomText className="font-sans-medium text-[11px] text-muted-foreground">
          Read-only · replies paused
        </CustomText>
      </View>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

/** Phone and WhatsApp with a broken link between them; used for the offline empty inbox. */
export function UnpluggedArt() {
  const dashes = (
    <View className="flex-row gap-1 px-1.5">
      {[0, 1, 2].map((key) => (
        <View key={key} className="h-0.5 w-1.5 rounded-full bg-border" />
      ))}
    </View>
  );
  return (
    <View
      className="mb-2 flex-row items-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
        <CustomIcon as={Smartphone} size={26} strokeWidth={1.5} className="text-muted-foreground" />
      </View>
      {dashes}
      <View className="h-8 w-8 items-center justify-center rounded-full bg-warning-pill-bg">
        <CustomIcon as={Unplug} size={15} className="text-warning-pill-fg" />
      </View>
      {dashes}
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
        <WhatsAppMark size={28} />
      </View>
    </View>
  );
}
