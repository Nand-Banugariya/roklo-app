import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";
import { CustomIcon } from "./customicon";
import { CustomText } from "./customtext";

export function CustomNavItem({
  label,
  description,
  icon,
  active,
  onPress,
  disabled,
  chevron,
  destructive,
}: {
  label: string;
  description?: string;
  icon: LucideIcon;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
  chevron?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "min-h-12 flex-row items-center gap-3 rounded-xl px-3.5 py-3 active:bg-ink-100",
        active && "bg-brand-50 active:bg-brand-100",
        disabled && "opacity-40",
      )}
    >
      <CustomIcon
        as={icon}
        size={21}
        strokeWidth={active ? 2 : 1.7}
        className={
          destructive
            ? "text-error-fg"
            : active
              ? "text-brand-700"
              : "text-ink-600"
        }
      />
      <View className="flex-1 gap-0.5">
        <CustomText
          className={cn(
            "text-sm",
            active
              ? "font-sans-semibold text-brand-800 dark:text-white"
              : "font-sans-medium text-ink-900 dark:text-white",
            destructive && "text-error-fg dark:text-error-fg",
          )}
        >
          {label}
        </CustomText>
        {description && (
          <CustomText className="text-xs leading-5 text-ink-600 dark:text-white">
            {description}
          </CustomText>
        )}
      </View>
      {active ? (
        <View className="h-1.5 w-1.5 rounded-full bg-brand-600" />
      ) : chevron ? (
        <CustomIcon as={ChevronRight} size={17} className="text-ink-400" />
      ) : null}
    </Pressable>
  );
}
