import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "./motion-pressable";

export function MenuRow({ title, description, icon, onPress, disabled }: {
  title: string; description?: string; icon: LucideIcon; onPress: () => void; disabled?: boolean;
}) {
  return <MotionPressable role="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} className="min-h-16 flex-row items-center gap-4 px-5 py-4 active:bg-accent">
    <CustomIcon as={icon} size={22} strokeWidth={1.7} className={disabled ? "text-ink-400" : "text-primary"} />
    <View className="min-w-0 flex-1 gap-1">
      <CustomText className={disabled ? "font-sans-medium text-base text-ink-400" : "font-sans-medium text-base"}>{title}</CustomText>
      {description && <CustomText className="text-xs leading-5 text-muted-foreground">{description}</CustomText>}
    </View>
    <CustomIcon as={ChevronRight} size={18} className="text-ink-400" />
  </MotionPressable>;
}
