import type { ReactNode } from "react";
import { View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomText } from "@/components/shadcn-custom/customtext";

/** Settings edits replace the section's content; they never create an overlay. */
export function SettingsInlineForm({ open, onClose, title, description, children }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode;
}) {
  if (!open) return null;
  return <View className="gap-5 rounded-xl border border-border bg-card p-5">
    <View className="flex-row items-center gap-3"><CustomText role="heading" className="flex-1 font-sans-semibold text-xl">{title}</CustomText>
      <CustomButton variant="ghost" size="xl" onPress={onClose}>Cancel</CustomButton></View>
    {description && <CustomText className="text-sm leading-6 text-muted-foreground">{description}</CustomText>}
    {children}
  </View>;
}
