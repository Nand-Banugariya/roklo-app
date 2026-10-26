import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "./motion-pressable";

export function goBack() { if (router.canGoBack()) router.back(); else router.replace("/inbox"); }
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View className="min-h-16 flex-row items-center gap-3 border-b border-border bg-card px-3 py-3">
    <MotionPressable role="button" accessibilityLabel="Go back" onPress={goBack}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-accent">
      <CustomIcon as={ArrowLeft} size={23} className="text-foreground" />
    </MotionPressable>
    <View className="min-w-0 flex-1 gap-0.5">
      <CustomText role="heading" className="font-sans-semibold text-xl" numberOfLines={1}>{title}</CustomText>
      {subtitle && <CustomText className="text-xs text-muted-foreground" numberOfLines={1}>{subtitle}</CustomText>}
    </View>
  </View>;
}
