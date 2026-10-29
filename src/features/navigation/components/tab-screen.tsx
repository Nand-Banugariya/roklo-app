import { router } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { Keyboard, View, useWindowDimensions } from "react-native";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { ActiveNumberBar } from "@/features/messaging/components/active-number-bar";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { isConnected } from "@/features/messaging/types";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import { APP_DESTINATIONS, MORE_HREF, type DestinationId } from "../config/navigation";
import { useKeyboardVisible } from "../hooks/use-keyboard-visible";
import { BottomNavigation } from "./bottom-navigation";
import { NumberSwitcher } from "./number-switcher";
import { ProfileMenu } from "./profile-menu";

/**
 * A bottom-tab screen (Chats, Broadcast, Contacts, More): its large title with the profile photo, the number or
 * workspace line, the content, and the bottom tabs. They belong to the screen, as on WhatsApp, so they
 * slide in with it when you come back from a chat; drawn by the shell above the stack, they popped in
 * after the transition and pushed the list down. The tab is named by the screen, never read from the
 * URL, so the title is right for the whole transition. `header` takes the title row's place while set (the
 * inbox's selected-chat actions, as WhatsApp's top bar does).
 */
export function TabScreen({
  tab,
  header,
  children,
}: PropsWithChildren<{ tab: DestinationId | "more"; header?: ReactNode }>) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const keyboardVisible = useKeyboardVisible();
  const workspace = useAppSelector(selectActiveWorkspace);
  const { numbers } = useMessaging();
  const disabled = workspace?.status === "DISABLED";
  const more = tab === "more";
  const label = more ? "More" : APP_DESTINATIONS.find((item) => item.id === tab)?.label;
  const numberScoped = tab === "inbox";
  // Broadcasts send from any connected number, so no number (or workspace) line under the title.
  const bare = more || tab === "broadcasts";
  function navigate(id: DestinationId) {
    if (disabled && id !== "settings") return;
    Keyboard.dismiss();
    router.navigate(APP_DESTINATIONS.find((item) => item.id === id)!.href);
  }
  return (
    <View className="flex-1 bg-card">
      <View className="gap-1 bg-card px-5 pb-3 pt-3">
        {header ?? (
          <View className="min-h-11 flex-row items-center gap-2">
            <View className="min-w-0 flex-1 gap-1">
              <CustomText
                role="heading"
                className="font-sans-semibold text-[28px] leading-9 tracking-[-0.7px]"
              >
                {label}
              </CustomText>
            </View>
            {/* The signed-in person's photo (or initials), opening their profile popup. */}
            <ProfileMenu />
          </View>
        )}
        {bare ? null : numberScoped ? (
          <ActiveNumberBar disabled={disabled} />
        ) : (
          <View className="flex-row items-center gap-3">
            <CustomText numberOfLines={1} className="min-w-0 flex-1 text-xs text-muted-foreground">
              {workspace?.name}
            </CustomText>
            <NumberSwitcher
              count={numbers.length}
              offline={numbers.filter((number) => !isConnected(number)).length}
              disabled={disabled}
              onPress={() => {
                Keyboard.dismiss();
                router.push("/connections");
              }}
            />
          </View>
        )}
      </View>
      <View className="min-h-0 flex-1">{children}</View>
      {!wide && !keyboardVisible && (
        <BottomNavigation
          activeId={more ? undefined : tab}
          moreActive={more}
          disabled={disabled}
          onNavigate={navigate}
          onMore={() => {
            Keyboard.dismiss();
            router.navigate(MORE_HREF);
          }}
        />
      )}
    </View>
  );
}
