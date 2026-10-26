import { View } from "react-native";
import { CustomNavItem } from "@/components/shadcn-custom/customnavitem";
import { APP_DESTINATIONS, type DestinationId } from "../config/navigation";
import { NAVIGATION_ICONS } from "../config/navigation-icons";

export function NavigationList({
  activeId,
  disabled,
  onNavigate,
  descriptions,
}: {
  activeId?: string;
  disabled?: boolean;
  onNavigate: (id: DestinationId) => void;
  descriptions?: boolean;
}) {
  return (
    <View className="gap-1" accessibilityLabel="Workspace navigation">
      {APP_DESTINATIONS.filter((item) => item.id !== "settings").map((item) => (
        <CustomNavItem
          key={item.id}
          label={item.label}
          description={descriptions ? item.description : undefined}
          icon={NAVIGATION_ICONS[item.id]}
          active={activeId === item.id}
          disabled={disabled}
          onPress={() => onNavigate(item.id)}
        />
      ))}
    </View>
  );
}
