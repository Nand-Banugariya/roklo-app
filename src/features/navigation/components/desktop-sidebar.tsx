import { Settings } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { RokloWordmark } from "@/components/brand/roklo-wordmark";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomNavItem } from "@/components/shadcn-custom/customnavitem";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useAppSelector } from "@/store/hooks";
import type { DestinationId } from "../config/navigation";
import { NavigationList } from "./navigation-list";

export function DesktopSidebar({
  activeId,
  disabled,
  onNavigate,
  onAccount,
}: {
  activeId?: string;
  disabled?: boolean;
  onNavigate: (id: DestinationId) => void;
  onAccount: () => void;
}) {
  const user = useAppSelector((state) => state.auth.user);
  return (
    <View className="w-[232px] border-r border-ink-200 bg-card" accessibilityLabel="Sidebar">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Roklo home"
        onPress={() => onNavigate("inbox")}
        className="h-20 justify-center px-6"
      >
        <RokloWordmark width={142} height={28} />
      </Pressable>
      <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 20 }}>
        <CustomText className="mb-3 px-3.5 font-sans-medium text-[10px] tracking-[1.5px] text-ink-500">
          YOUR WORKSPACE
        </CustomText>
        <NavigationList activeId={activeId} disabled={disabled} onNavigate={onNavigate} />
      </ScrollView>
      <View className="gap-3 border-t border-ink-200 p-3">
        <CustomNavItem
          label="Settings"
          icon={Settings}
          active={activeId === "settings"}
          onPress={() => onNavigate("settings")}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your account"
          onPress={onAccount}
          className="min-h-16 flex-row items-center gap-3 rounded-xl bg-ink-50 p-3 active:bg-ink-100"
        >
          <CustomAvatar name={user?.name} src={user?.image} size={36} />
          <View className="flex-1 gap-1">
            <CustomText numberOfLines={1} className="font-sans-semibold text-[13px]">
              {user?.name?.split("\n")[0] || "Your account"}
            </CustomText>
            <CustomText className="text-xs text-ink-600">Account & appearance</CustomText>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
