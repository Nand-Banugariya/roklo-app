import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";

export function CustomSwitch({
  checked,
  onCheckedChange,
  accessibilityLabel,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      role="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled: !!disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className={cn("h-11 w-12 items-center justify-center", disabled && "opacity-40")}
    >
      <View
        className={cn(
          "h-6 w-10 justify-center rounded-full px-0.5",
          checked ? "items-end bg-brand-600" : "items-start bg-ink-300",
        )}
      >
        <View className="h-5 w-5 rounded-full bg-white" />
      </View>
    </Pressable>
  );
}
