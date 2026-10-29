import type { LucideIcon } from "lucide-react-native";
import { useEffect, type PropsWithChildren, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { cn } from "@/lib/utils";

export function InboxState({
  icon,
  art,
  title,
  description,
  action,
  actionIcon,
  onAction,
}: {
  icon?: LucideIcon;
  art?: ReactNode;
  title: string;
  description?: string;
  action?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8 py-12">
      {art ??
        (icon && (
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <CustomIcon as={icon} size={30} strokeWidth={1.5} className="text-primary" />
          </View>
        ))}
      <CustomText className="text-center font-sans-semibold text-xl">{title}</CustomText>
      {!!description && (
        <CustomText className="max-w-[340px] text-center text-sm leading-6 text-muted-foreground">
          {description}
        </CustomText>
      )}
      {action && onAction && (
        <CustomButton
          size="xl"
          className="mt-2"
          onPress={onAction}
          leadingIcon={
            actionIcon && (
              <CustomIcon as={actionIcon} size={18} className="text-primary-foreground" />
            )
          }
        >
          {action}
        </CustomButton>
      )}
    </View>
  );
}
/**
 * The chat list skeleton's breathing: one soft opacity pulse (1 → 0.45 → 1, 1.8 s a cycle), so it reads
 * as loading rather than stuck. Still under reduced motion.
 */
export function Pulse({ children, fill }: PropsWithChildren<{ fill?: boolean }>) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduced, opacity]);
  // Style only: Reanimated never receives NativeWind class names.
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[fill ? { flex: 1 } : null, style]}>{children}</Animated.View>;
}

/** The placeholder thread, oldest first: which side, how wide, its text lines (widths), and a photo. */
const THREAD_BUBBLES: {
  side: "in" | "out";
  width: `${number}%`;
  lines: `${number}%`[];
  media?: boolean;
}[] = [
  { side: "in", width: "64%", lines: ["90%", "55%"] },
  { side: "in", width: "46%", lines: ["80%"] },
  { side: "out", width: "60%", lines: [], media: true },
  { side: "out", width: "72%", lines: ["95%", "70%", "40%"] },
  { side: "in", width: "58%", lines: ["85%", "45%"] },
  { side: "out", width: "44%", lines: ["75%"] },
  { side: "in", width: "68%", lines: ["92%", "60%"] },
];
/**
 * Placeholder bubbles over the chat wallpaper while a thread loads, with the day chip the real thread
 * opens with. They rise into place one after another, each with text lines (and one a photo) so it reads
 * as a chat. Reduced motion: no entrance.
 */
export function ThreadSkeleton() {
  const reduced = useReducedMotion();
  return (
    <View
      accessibilityLabel="Loading messages"
      accessibilityState={{ busy: true }}
      className="flex-1 justify-end gap-2 px-3 pb-4"
    >
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(220)}
        style={{ alignSelf: "center", marginBottom: 4 }}
      >
        <View className="h-6 w-20 rounded-full bg-card opacity-80" />
      </Animated.View>
      {THREAD_BUBBLES.map((bubble, index) => (
        <SkeletonBubble key={index} {...bubble} index={index} animate={!reduced} />
      ))}
    </View>
  );
}

function SkeletonBubble({
  side,
  width,
  lines,
  media,
  index,
  animate,
}: (typeof THREAD_BUBBLES)[number] & { index: number; animate: boolean }) {
  const out = side === "out";
  // Style only on the Animated view: Reanimated never receives NativeWind class names.
  return (
    <Animated.View
      entering={
        animate
          ? FadeInDown.delay(index * 60)
              .duration(280)
              .reduceMotion(ReduceMotion.System)
          : undefined
      }
      style={{ width, alignSelf: out ? "flex-end" : "flex-start" }}
    >
      <View
        className={cn(
          "gap-2 rounded-2xl px-3 pb-2 pt-2.5",
          out ? "rounded-tr-[4px] bg-bubble-out opacity-80" : "rounded-tl-[4px] bg-card opacity-90",
          media && "p-1",
        )}
      >
        {media && <View className="h-36 w-full rounded-xl bg-black/10 dark:bg-white/10" />}
        {lines.map((line, at) => (
          <View
            key={at}
            style={{ width: line }}
            className="h-2.5 rounded-full bg-black/10 dark:bg-white/10"
          />
        ))}
        <View
          className={cn(
            "h-2 w-10 self-end rounded-full bg-black/5 dark:bg-white/5",
            media && "mr-2 mb-1",
          )}
        />
      </View>
    </Animated.View>
  );
}

export function InboxSkeleton() {
  return (
    <Pulse>
      <View
        accessibilityLabel="Loading conversations"
        accessibilityState={{ busy: true }}
        className="px-5"
      >
        {/* Same 72px rows as the loaded chat list, so nothing jumps when chats arrive. */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
          <View key={key} className="min-h-[72px] flex-row items-center gap-4 py-3">
            <View className="h-12 w-12 rounded-full bg-muted" />
            <View className="flex-1 gap-2.5">
              <View className="h-3 w-2/5 rounded bg-muted" />
              <View className="h-3 w-4/5 rounded bg-muted" />
            </View>
          </View>
        ))}
      </View>
    </Pulse>
  );
}
