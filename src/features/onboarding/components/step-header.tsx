import { View } from "react-native";
import { CustomText } from "@/components/shadcn-custom/customtext";

export function StepHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <View className="gap-3">
      {eyebrow && (
        <CustomText className="font-sans-semibold text-xs uppercase tracking-[1.2px] text-brand-700">
          {eyebrow}
        </CustomText>
      )}
      <CustomText
        role="heading"
        className="font-display text-[36px] leading-[40px] tracking-[-0.7px] text-ink-900"
      >
        {title}
      </CustomText>
      {!!description && (
        <CustomText className="text-[15px] leading-6 text-ink-700">{description}</CustomText>
      )}
    </View>
  );
}
