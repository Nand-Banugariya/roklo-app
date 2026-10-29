import { CircleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export interface CustomFormControlProps {
  nativeID: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export interface CustomFormFieldProps extends Omit<ViewProps, "children"> {
  id: string;
  label?: string;
  required?: boolean;
  optional?: boolean;
  help?: string;
  error?: string | null;
  size?: "md" | "lg";
  children: ReactNode | ((control: CustomFormControlProps) => ReactNode);
}

export function CustomFormField({
  id,
  label,
  required,
  optional,
  help,
  error,
  size = "md",
  children,
  className,
  ...props
}: CustomFormFieldProps) {
  const control = { nativeID: id, accessibilityLabel: label, accessibilityHint: error || help };
  return (
    <View className={cn("gap-1.5", size === "lg" && "gap-2", className)} {...props}>
      {label && (
        <Label
          nativeID={`${id}-label`}
          className={cn(size === "lg" && "font-sans-semibold text-[13px]")}
        >
          {label}
          {required && <Text className="text-error-fg"> *</Text>}
          {optional && <Text className="font-sans text-ink-600"> Optional</Text>}
        </Label>
      )}
      {typeof children === "function" ? children(control) : children}
      {error ? (
        <View className="flex-row items-start gap-1.5" accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size={14} className="mt-0.5 text-error-fg" />
          <Text className="flex-1 font-sans-medium text-[13px] text-error-fg">{error}</Text>
        </View>
      ) : help ? (
        <Text className="text-[13px] text-ink-600">{help}</Text>
      ) : null}
    </View>
  );
}
