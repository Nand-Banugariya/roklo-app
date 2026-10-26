import type { ComponentProps } from "react";
import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import { View } from "react-native";
import type { CustomSelect } from "@/components/shadcn-custom/customselect";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";

/** Expands in the document flow so mobile settings never open popovers. */
export function SettingsSelect({ value, options, onValueChange, placeholder, accessibilityLabel, nativeID, emptyMessage }: ComponentProps<typeof CustomSelect>) {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <View className="rounded-lg border border-border bg-card">
    <MotionPressable role="button" nativeID={nativeID} accessibilityLabel={accessibilityLabel} accessibilityState={{ expanded }}
      onPress={() => setExpanded((old) => !old)} className="min-h-12 flex-row items-center gap-3 px-3.5 py-3">
      <CustomText className="flex-1 text-sm">{selected?.label || placeholder}</CustomText><CustomIcon as={expanded ? ChevronUp : ChevronDown} size={17} className="text-muted-foreground" />
    </MotionPressable>
    {expanded && <View className="border-t border-border">
      {options.length ? options.map((option) => <MotionPressable key={option.value} role="radio" accessibilityLabel={option.label}
        accessibilityState={{ checked: option.value === value }} aria-checked={option.value === value}
        onPress={() => { onValueChange(option.value); setExpanded(false); }} className="min-h-12 flex-row items-center gap-3 px-4 py-3 active:bg-accent">
        <CustomText className="flex-1 text-sm">{option.label}</CustomText>{option.value === value && <CustomIcon as={Check} size={18} className="text-primary" />}
      </MotionPressable>) : <CustomText className="px-4 py-3 text-sm text-muted-foreground">{emptyMessage || "No options available"}</CustomText>}
    </View>}
  </View>;
}
