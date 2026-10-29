import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View, type ViewProps } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type CustomAlertTone = "info" | "success" | "warning" | "error";
const TONE = {
  info: { icon: Info, box: "border-info-border bg-info-bg", text: "text-info-fg" },
  success: { icon: CircleCheck, box: "border-brand-200 bg-success-bg", text: "text-success-fg" },
  warning: {
    icon: TriangleAlert,
    box: "border-warning-border bg-warning-bg",
    text: "text-warning-fg",
  },
  error: { icon: CircleAlert, box: "border-error-border bg-error-bg", text: "text-error-fg" },
};

export interface CustomAlertProps extends ViewProps {
  tone?: CustomAlertTone;
  title?: string;
  /** In place of the tone's own icon, when one says more (a crossed-out calendar for an end date that passed). */
  icon?: LucideIcon;
  children?: ReactNode;
  onDismiss?: () => void;
}

/**
 * A boxed message in its tone's colours: the icon in a row beside the title and text, as the cards lay out
 * their icons (pinned absolutely in the box, as the base Alert does, it drew clipped on Android).
 */
export function CustomAlert({
  tone = "info",
  title,
  icon,
  children,
  onDismiss,
  className,
  ...props
}: CustomAlertProps) {
  const style = TONE[tone];
  return (
    <View
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      accessibilityLiveRegion="polite"
      className={cn(
        "w-full flex-row gap-2.5 rounded-lg border px-3.5 py-3",
        style.box,
        onDismiss && "pr-11",
        className,
      )}
      {...props}
    >
      {/* The height of the first line, so the icon sits level with it. */}
      <View className="h-5 w-5 items-center justify-center">
        <Icon as={icon ?? style.icon} size={17} strokeWidth={2.2} className={style.text} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        {title && (
          <Text className={cn("font-sans-semibold text-sm leading-5", style.text)}>{title}</Text>
        )}
        {children != null && (
          <Text className={cn("text-sm leading-[21px]", style.text)}>{children}</Text>
        )}
      </View>
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          className="absolute right-0 top-0 h-11 w-11 items-center justify-center"
        >
          <Icon as={X} size={16} className={style.text} />
        </Pressable>
      )}
    </View>
  );
}
