import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import type { StatusStyle } from "../constants";
import type { BroadcastTag } from "../types";
import { formatCount } from "../utils/broadcast-format";

export function StatusPill({ status, size = "md" }: { status: StatusStyle; size?: "sm" | "md" }) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-1 self-start rounded-full",
        status.pill,
        size === "sm" ? "h-5 px-2" : "h-6 px-2.5",
      )}
    >
      <CustomIcon
        as={status.icon}
        size={size === "sm" ? 10 : 12}
        strokeWidth={2.4}
        className={status.text}
      />
      <CustomText
        className={cn(
          "font-sans-semibold",
          status.text,
          size === "sm" ? "text-[10px]" : "text-[11px]",
        )}
      >
        {status.label}
      </CustomText>
    </View>
  );
}

/**
 * Sent in the status's colour, then failed in red, so a finish with failures doesn't read all green.
 * Grows in; while sending, light runs along it (not under reduced motion).
 */
export function ProgressBar({
  sent,
  failed,
  total,
  barClass,
  live,
  height = 6,
  label,
}: {
  sent: number;
  failed: number;
  total: number;
  barClass: string;
  live?: boolean;
  height?: number;
  label: string;
}) {
  const sentShare = total > 0 ? Math.min(1, sent / total) : 0;
  const failedShare = total > 0 ? Math.min(1 - sentShare, failed / total) : 0;
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) grow.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [grow, reduced]);
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!live || reduced) return;
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [live, reduced, sweep]);
  const sentStyle = useAnimatedStyle(() => ({ width: `${sentShare * 100 * grow.value}%` }));
  const failedStyle = useAnimatedStyle(() => ({ width: `${failedShare * 100 * grow.value}%` }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -60 + sweep.value * (width * sentShare + 60) }],
  }));
  const pct = Math.round(sentShare * 100);
  return (
    <View
      role="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: pct,
        text: `${pct}% sent${failed ? `, ${formatCount(failed)} failed` : ""}`,
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="flex-row gap-px overflow-hidden rounded-full bg-ink-150"
      style={{ height }}
    >
      {/* Style only on the animated views (Reanimated never receives NativeWind class names); colour inside. */}
      <Animated.View style={[{ height: "100%", overflow: "hidden", borderRadius: 999 }, sentStyle]}>
        <View className={cn("h-full w-full rounded-full", barClass)} />
        {live && !reduced && (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 60,
                backgroundColor: "#ffffff",
                opacity: 0.3,
              },
              sweepStyle,
            ]}
          />
        )}
      </Animated.View>
      {failedShare > 0 && (
        <Animated.View
          style={[{ height: "100%", overflow: "hidden", borderRadius: 999 }, failedStyle]}
        >
          <View className="h-full w-full rounded-full bg-error-solid" />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * A broadcast's tags as one row of soft pills in each tag's colour (as the tag picker shows them), the first
 * `max` and then "+N" for the rest.
 */
export function TagChips({ tags, max = 3 }: { tags: BroadcastTag[]; max?: number }) {
  const { colors } = useRokloTheme();
  if (!tags.length) return null;
  const rest = tags.length - max;
  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {tags.slice(0, max).map((tag) => {
        // A 6-digit colour gets a faint tint of itself behind it; anything else falls back to the neutral.
        const hex = tag.color?.length === 7 ? tag.color : null;
        return (
          <View
            key={tag.id}
            className="h-6 max-w-[140px] flex-row items-center gap-1.5 rounded-full px-2.5"
            style={{ backgroundColor: hex ? `${hex}24` : colors.accent }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: hex ?? colors["ink-400"] }}
            />
            <CustomText
              numberOfLines={1}
              className="shrink font-sans-medium text-[11px] text-foreground"
            >
              {tag.name}
            </CustomText>
          </View>
        );
      })}
      {rest > 0 && (
        <View className="h-6 items-center justify-center rounded-full bg-accent px-2">
          <CustomText className="font-sans-semibold text-[11px] text-muted-foreground">
            +{rest}
          </CustomText>
        </View>
      )}
    </View>
  );
}

/** A detail screen's stat: icon, big number, label and an optional rate. */
export function StatTile({
  icon,
  label,
  value,
  caption,
  tint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  tint: string;
  children?: ReactNode;
}) {
  return (
    <View className="min-w-[46%] flex-1 gap-2 rounded-2xl border border-border bg-card p-3.5">
      <View className="flex-row items-center gap-2">
        <View className={cn("h-7 w-7 items-center justify-center rounded-lg", tint)}>
          <CustomIcon as={icon} size={14} strokeWidth={2.2} className="text-foreground" />
        </View>
        <CustomText className="font-sans-medium text-xs text-muted-foreground">{label}</CustomText>
      </View>
      <View className="flex-row items-baseline gap-1.5">
        <CustomText className="font-sans-semibold text-2xl tracking-[-0.5px]">{value}</CustomText>
        {!!caption && (
          <CustomText className="font-sans-medium text-xs text-muted-foreground">
            {caption}
          </CustomText>
        )}
      </View>
      {children}
    </View>
  );
}
