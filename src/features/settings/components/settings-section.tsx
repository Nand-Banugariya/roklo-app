import type { ReactNode } from "react";
import { View } from "react-native";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  danger,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
  action?: ReactNode;
}) {
  return (
    <View
      className={cn(
        "gap-5 rounded-xl border border-ink-200 bg-card p-5 sm:p-6",
        danger && "border-error-border",
      )}
    >
      <View className="gap-3 sm:flex-row sm:items-start">
        <View className="min-w-0 gap-1.5 sm:flex-1">
          <CustomText
            role="heading"
            className={cn(
              "font-sans-semibold text-[15px] leading-6 dark:text-white",
              danger && "text-error-fg dark:text-error-fg",
            )}
          >
            {title}
          </CustomText>
          {description && (
            <SettingsDescription>{description}</SettingsDescription>
          )}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SettingsDescription({ children }: { children: ReactNode }) {
  return (
    <CustomText className="text-[13px] leading-5 text-ink-600 dark:text-white">
      {children}
    </CustomText>
  );
}

export function SettingsRow({
  title,
  description,
  children,
  divided,
  inline,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  divided?: boolean;
  inline?: boolean;
}) {
  return (
    <View
      className={cn(
        "gap-3",
        inline ? "flex-row items-center" : "sm:flex-row sm:items-center",
        divided && "border-t border-ink-150 pt-4",
      )}
    >
      <View className={cn("min-w-0 gap-1", inline ? "flex-1" : "sm:flex-1")}>
        <CustomText className="font-sans-medium text-sm leading-5 dark:text-white">
          {title}
        </CustomText>
        {description && (
          <SettingsDescription>{description}</SettingsDescription>
        )}
      </View>
      <View className={inline ? "shrink-0" : "w-full gap-2 sm:w-auto"}>
        {children}
      </View>
    </View>
  );
}

export function PreviewNote() {
  return (
    <CustomText className="text-xs leading-5 text-ink-500 dark:text-white">
      Preview only. Changes are not saved.
    </CustomText>
  );
}
