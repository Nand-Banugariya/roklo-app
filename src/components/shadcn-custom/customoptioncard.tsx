import { Check, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { CustomIcon } from "./customicon";
import { CustomText } from "./customtext";
import { cn } from "@/lib/utils";

export function CustomOptionCard({
  label,
  description,
  icon,
  selected,
  onPress,
  multiple,
  compact,
}: {
  label: string;
  description?: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        "min-h-12 flex-row items-center gap-3 rounded-xl border border-ink-200 bg-card px-4 py-3.5 active:bg-ink-75",
        compact && "flex-1",
        selected && "border-brand-600 bg-brand-50 active:bg-brand-100",
      )}
    >
      {icon && (
        <CustomIcon
          as={icon}
          size={21}
          className={selected ? "text-brand-700" : "text-ink-600"}
        />
      )}
      <View className="flex-1 gap-1">
        <CustomText
          className={cn(
            "font-sans-medium text-sm",
            selected && "text-brand-800",
          )}
        >
          {label}
        </CustomText>
        {description && (
          <CustomText className="text-[13px] leading-5 text-ink-600">
            {description}
          </CustomText>
        )}
      </View>
      <View
        className={cn(
          "h-5 w-5 items-center justify-center border border-ink-300",
          multiple ? "rounded-md" : "rounded-full",
          selected && "border-brand-600 bg-brand-600",
        )}
      >
        {selected && (
          <CustomIcon
            as={Check}
            size={13}
            strokeWidth={3}
            className="text-primary-foreground"
          />
        )}
      </View>
    </Pressable>
  );
}
