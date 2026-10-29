import { Check, CheckCheck, Megaphone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import type { BroadcastCounts } from "../types";
import { formatCount } from "../utils/broadcast-format";

// A deep surface in both themes, like a premium card: fixed colours, so it reads the same light or dark.
const SURFACE = { from: "#0f5a44", to: "#051f18", glow: "#3fd49d" };
/** Status colours tuned to sit on the dark surface. */
const COLORS = { scheduled: "#7cb4ff", paused: "#f5b84a", completed: "#b8f0d8", mint: "#45cf9c" };
const STAGE = 124;

/** Counts up to `value` (ease-out, ~0.9 s) the first time it's known and whenever it changes. */
function useCountUp(value: number) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  // Under reduced motion the number is simply there.
  return reduced ? value : shown;
}

/**
 * The overview on top of the Broadcast tab: the total counting up beside a message going out to many
 * (bubbles whose ticks turn sent, delivered, read), then how many are scheduled, paused and completed.
 */
export function BroadcastsOverview({ counts }: { counts: BroadcastCounts | null }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const total = useCountUp(counts?.total ?? 0);
  const scheduled = useCountUp(counts?.counts.SCHEDULED ?? 0);
  const paused = useCountUp(counts?.counts.PAUSED ?? 0);
  const completed = useCountUp(counts?.counts.COMPLETED ?? 0);
  const reduced = useReducedMotion();
  const label = `${formatCount(counts?.total ?? 0)} broadcasts: ${counts?.counts.SCHEDULED ?? 0} scheduled, ${counts?.counts.PAUSED ?? 0} paused, ${counts?.counts.COMPLETED ?? 0} completed`;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(380)}
      style={{ marginHorizontal: 16 }}
    >
      <View
        onLayout={(event) =>
          setSize({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
        className="overflow-hidden rounded-[26px] border border-white/10"
        accessibilityLabel={label}
      >
        {/* Sized from the card's own layout, so the surface always covers it. */}
        {size.width > 0 && (
          <Svg
            width={size.width}
            height={size.height}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <Defs>
              <LinearGradient id="surface" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={SURFACE.from} />
                <Stop offset="1" stopColor={SURFACE.to} />
              </LinearGradient>
              <RadialGradient
                id="glow"
                cx={size.width - STAGE / 2 - 12}
                cy={STAGE / 2 + 8}
                r={size.width * 0.5}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={SURFACE.glow} stopOpacity={0.3} />
                <Stop offset="1" stopColor={SURFACE.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#surface)" />
            <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#glow)" />
          </Svg>
        )}

        <View className="flex-row items-center gap-2 pl-5 pr-3 pt-2">
          <View className="min-w-0 flex-1 gap-2 py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-[9px] border border-white/15 bg-white/10">
                <CustomIcon as={Megaphone} size={13} color="#ffffff" />
              </View>
              <CustomText className="font-sans-medium text-[13px] text-white/70">
                Broadcasts
              </CustomText>
            </View>
            <View>
              <CustomText className="font-sans-semibold text-[46px] leading-[50px] tracking-[-1.8px] text-white">
                {counts ? formatCount(total) : "—"}
              </CustomText>
              <CustomText numberOfLines={1} className="text-[13px] text-white/60">
                {counts?.total === 1 ? "broadcast" : "broadcasts"} in this workspace
              </CustomText>
            </View>
          </View>
          <DeliveryCascade />
        </View>

        <View className="mx-5 mb-4 mt-1 flex-row border-t border-white/10 pt-3.5">
          <Stat label="Scheduled" value={formatCount(scheduled)} color={COLORS.scheduled} />
          <View className="mx-3 w-px bg-white/10" />
          <Stat label="Paused" value={formatCount(paused)} color={COLORS.paused} />
          <View className="mx-3 w-px bg-white/10" />
          <Stat label="Completed" value={formatCount(completed)} color={COLORS.completed} />
        </View>
      </View>
    </Animated.View>
  );
}

/** One count, its status dot beside the label. */
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <View className="flex-row items-center gap-1.5">
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        <CustomText
          numberOfLines={1}
          className="font-sans-medium text-[10px] tracking-[0.6px] text-white/55"
        >
          {label.toUpperCase()}
        </CustomText>
      </View>
      <CustomText
        numberOfLines={1}
        className="font-sans-semibold text-[20px] tracking-[-0.4px] text-white"
      >
        {value}
      </CustomText>
    </View>
  );
}

/** One loop: the bubbles come in, their ticks go sent → delivered → read, then all fade and it starts over. */
const LOOP_MS = 5200;
const FADE_AT = 4500;
/** WhatsApp's read-tick blue. */
const READ = "#53bdeb";
/** Each bubble's width, how far in from the right, and its two "text" lines. */
const BUBBLES = [
  { width: 112, inset: 0, lines: [62, 40] },
  { width: 94, inset: 22, lines: [48, 30] },
  { width: 104, inset: 8, lines: [56, 36] },
];

/**
 * One message going out to many: outgoing bubbles slide in one after another, and each one's ticks turn
 * from sent (✓) to delivered (✓✓) to read (blue ✓✓), cascading down. Shows them all read, still, under
 * reduced motion.
 */
function DeliveryCascade() {
  const reduced = useReducedMotion();
  const clock = useSharedValue(reduced ? 4000 / LOOP_MS : 0);
  useEffect(() => {
    if (reduced) return;
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduced, clock]);
  return (
    <View
      style={{ width: STAGE, height: STAGE }}
      className="justify-center gap-2"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {BUBBLES.map((bubble, index) => (
        <Bubble key={index} clock={clock} index={index} bubble={bubble} />
      ))}
    </View>
  );
}

function Bubble({
  clock,
  index,
  bubble,
}: {
  clock: SharedValue<number>;
  index: number;
  bubble: (typeof BUBBLES)[number];
}) {
  // Its moments in the loop: in, delivered, read.
  const enter = 250 + index * 420;
  const delivered = enter + 900;
  const read = enter + 1700;
  const body = useAnimatedStyle(() => {
    const ms = clock.value * LOOP_MS;
    return {
      opacity: interpolate(ms, [enter, enter + 320, FADE_AT, FADE_AT + 400], [0, 1, 1, 0], "clamp"),
      transform: [
        { translateX: interpolate(ms, [enter, enter + 380], [-22, 0], "clamp") },
        { scale: interpolate(ms, [enter, enter + 240, enter + 380], [0.92, 1.03, 1], "clamp") },
      ],
    };
  });
  const sent = useAnimatedStyle(() => {
    const ms = clock.value * LOOP_MS;
    return {
      opacity: interpolate(
        ms,
        [enter + 200, enter + 320, delivered - 60, delivered],
        [0, 1, 1, 0],
        "clamp",
      ),
    };
  });
  const grey = useAnimatedStyle(() => {
    const ms = clock.value * LOOP_MS;
    return {
      opacity: interpolate(ms, [delivered - 60, delivered, read - 80, read], [0, 1, 1, 0], "clamp"),
      transform: [
        {
          scale: interpolate(
            ms,
            [delivered - 60, delivered + 120, delivered + 240],
            [0.6, 1.2, 1],
            "clamp",
          ),
        },
      ],
    };
  });
  const blue = useAnimatedStyle(() => {
    const ms = clock.value * LOOP_MS;
    return {
      opacity: interpolate(ms, [read - 80, read], [0, 1], "clamp"),
      transform: [
        { scale: interpolate(ms, [read - 80, read + 140, read + 280], [0.6, 1.25, 1], "clamp") },
      ],
    };
  });
  // Style only on the animated views (Reanimated never receives NativeWind class names).
  return (
    <Animated.View style={[{ alignSelf: "flex-end", marginRight: bubble.inset }, body]}>
      <View
        style={{ width: bubble.width }}
        className="h-[30px] flex-row items-center gap-2 rounded-[15px] rounded-br-[5px] border border-white/15 bg-white/10 pl-3 pr-2"
      >
        <View className="flex-1 gap-1">
          {bubble.lines.map((line, row) => (
            <View
              key={row}
              className="h-[3px] rounded-full bg-white/40"
              style={{ width: line * (bubble.width / 112) }}
            />
          ))}
        </View>
        <View className="h-3.5 w-4 items-center justify-center">
          <Animated.View style={[{ position: "absolute" }, sent]}>
            <CustomIcon as={Check} size={13} strokeWidth={2.6} color="rgba(255,255,255,0.7)" />
          </Animated.View>
          <Animated.View style={[{ position: "absolute" }, grey]}>
            <CustomIcon as={CheckCheck} size={14} strokeWidth={2.6} color="rgba(255,255,255,0.7)" />
          </Animated.View>
          <Animated.View style={[{ position: "absolute" }, blue]}>
            <CustomIcon as={CheckCheck} size={14} strokeWidth={2.6} color={READ} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}
