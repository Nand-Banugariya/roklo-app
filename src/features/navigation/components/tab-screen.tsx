import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { Keyboard, View, useWindowDimensions } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { ActiveNumberBar } from "@/features/messaging/components/active-number-bar";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { isConnected } from "@/features/messaging/types";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import { APP_DESTINATIONS, MORE_HREF, type DestinationId } from "../config/navigation";
import { useKeyboardVisible } from "../hooks/use-keyboard-visible";
import { BottomNavigation } from "./bottom-navigation";
import { MotionPressable } from "./motion-pressable";
import { NumberSwitcher } from "./number-switcher";

/**
 * A bottom-tab screen (Chats, Broadcast, Contacts, More): its large title with Alerts, the number or
 * workspace line, the content, and the bottom tabs. They belong to the screen, as on WhatsApp, so they
 * slide in with it when you come back from a chat; drawn by the shell above the stack, they popped in
 * after the transition and pushed the list down. The tab is named by the screen, never read from the
 * URL, so the title is right for the whole transition.
 */
export function TabScreen({ tab, children }: PropsWithChildren<{ tab: DestinationId | "more" }>) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const keyboardVisible = useKeyboardVisible();
  const workspace = useAppSelector(selectActiveWorkspace);
  const { numbers } = useMessaging();
  const disabled = workspace?.status === "DISABLED";
  const more = tab === "more";
  const label = more ? "More" : APP_DESTINATIONS.find((item) => item.id === tab)?.label;
  const numberScoped = tab === "inbox" || tab === "broadcasts";
  function navigate(id: DestinationId) {
    if (disabled && id !== "settings") return;
    Keyboard.dismiss();
    router.navigate(APP_DESTINATIONS.find((item) => item.id === id)!.href);
  }
  return <View className="flex-1 bg-card">
    <View className="gap-1 bg-card px-5 pb-3 pt-3">
      <View className="min-h-11 flex-row items-center gap-2">
        <View className="min-w-0 flex-1 gap-1">
          <CustomText role="heading" className="font-sans-semibold text-[28px] leading-9 tracking-[-0.7px]">{label}</CustomText>
        </View>
        <MotionPressable role="button" accessibilityLabel="Alerts" onPress={() => router.push("/alerts")}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-accent">
          <CustomIcon as={Bell} size={22} className="text-foreground" />
        </MotionPressable>
      </View>
      {more ? null : numberScoped ? <ActiveNumberBar disabled={disabled} /> : <View className="flex-row items-center gap-3">
        <CustomText numberOfLines={1} className="min-w-0 flex-1 text-xs text-muted-foreground">{workspace?.name}</CustomText>
        <NumberSwitcher count={numbers.length} offline={numbers.filter((number) => !isConnected(number)).length} disabled={disabled}
          onPress={() => { Keyboard.dismiss(); router.push("/connections"); }} />
      </View>}
    </View>
    <View className="min-h-0 flex-1">{children}</View>
    {!wide && !keyboardVisible && <BottomNavigation activeId={more ? undefined : tab} moreActive={more} disabled={disabled}
      onNavigate={navigate} onMore={() => { Keyboard.dismiss(); router.navigate(MORE_HREF); }} />}
  </View>;
}
