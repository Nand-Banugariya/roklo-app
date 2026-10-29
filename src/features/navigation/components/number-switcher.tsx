import { View } from "react-native";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { WhatsAppMark } from "@/features/messaging/components/whatsapp-mark";
import { cn } from "@/lib/utils";
import { MotionPressable } from "./motion-pressable";

export function NumberSwitcher({
  count,
  offline = 0,
  disabled,
  onPress,
}: {
  count: number;
  offline?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={`WhatsApp numbers, ${count} linked${offline ? `, ${offline} disconnected` : ""}. Switch number`}
      accessibilityHint="Open the WhatsApp numbers screen"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "min-h-11 shrink-0 flex-row items-center gap-2 rounded-full border border-border bg-accent px-3 active:bg-muted",
        disabled && "opacity-40",
      )}
    >
      <WhatsAppMark size={20} />
      <CustomText className="font-sans-medium text-xs">Numbers</CustomText>
      {count > 0 && (
        <View
          className={cn(
            "min-w-5 items-center rounded-full px-1.5 py-0.5",
            offline ? "bg-warning-pill-bg" : "bg-brand-100",
          )}
        >
          <CustomText
            className={cn(
              "font-sans-semibold text-[10px]",
              offline ? "text-warning-pill-fg" : "text-primary",
            )}
          >
            {count > 99 ? "99+" : count}
          </CustomText>
        </View>
      )}
    </MotionPressable>
  );
}
