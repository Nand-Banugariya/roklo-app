import { LayoutGrid, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { cn } from "@/lib/utils";
import { APP_DESTINATIONS, PRIMARY_DESTINATIONS, type DestinationId } from "../config/navigation";
import { NAVIGATION_ICONS } from "../config/navigation-icons";
import { MotionPressable } from "./motion-pressable";

export function BottomNavigation({
  activeId,
  moreActive,
  disabled,
  onNavigate,
  onMore,
}: {
  activeId?: string;
  moreActive?: boolean;
  disabled?: boolean;
  onNavigate: (id: DestinationId) => void;
  onMore: () => void;
}) {
  return (
    <View
      className="flex-row border-t border-border bg-card px-2 pt-2"
      style={{ paddingBottom: 8 }}
      accessibilityLabel="Main navigation"
    >
      {PRIMARY_DESTINATIONS.map((id) => {
        const item = APP_DESTINATIONS.find((value) => value.id === id)!;
        return (
          <Tab
            key={id}
            label={item.label}
            icon={NAVIGATION_ICONS[id]}
            active={!moreActive && activeId === id}
            disabled={disabled}
            onPress={() => onNavigate(id)}
          />
        );
      })}
      {/* More stays available in a disabled workspace: it holds Settings and workspace switching. */}
      <Tab label="More" icon={LayoutGrid} active={!!moreActive} onPress={onMore} />
    </View>
  );
}

function Tab({
  label,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "min-h-14 min-w-0 flex-1 items-center justify-center gap-1",
        disabled && "opacity-40",
      )}
    >
      <View className={cn("w-14 items-center rounded-full py-1", active && "bg-brand-100")}>
        <CustomIcon
          as={icon}
          size={23}
          strokeWidth={active ? 2 : 1.7}
          className={active ? "text-primary" : "text-muted-foreground"}
        />
      </View>
      <CustomText
        numberOfLines={1}
        className={cn(
          "text-[11px]",
          active ? "font-sans-semibold text-primary" : "font-sans-medium text-muted-foreground",
        )}
      >
        {label}
      </CustomText>
    </MotionPressable>
  );
}
