import { Megaphone, MessageCircle, UserRound } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { PulseHalo } from "@/features/messaging/components/connection-pulse";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";

const LANE = 84;
const TRAVEL_MS = 1500;
const STAGGER_MS = 350;
/** Each recipient in a different soft tone, as contacts' avatars are. */
const RECIPIENTS = ["bg-brand-100", "bg-info-tint", "bg-purple-tint"];
const RECIPIENT_ICON = ["text-brand-700", "text-info-fg", "text-purple-fg"];

/**
 * The broadcast empty state's art, kin to the chat list's: a megaphone sending one message out to many.
 * Messages travel to each recipient in turn and the recipient lights up as one arrives; still under reduced motion.
 */
export function BroadcastArt() {
  const { colors } = useRokloTheme();
  const reduced = useReducedMotion();
  const lanes = [
    useSharedValue(reduced ? 1 : 0),
    useSharedValue(reduced ? 1 : 0),
    useSharedValue(reduced ? 1 : 0),
  ];
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    lanes.forEach((lane, index) => {
      lane.value = 0;
      // Travel, rest, then start over: the three lanes one after another.
      lane.value = withDelay(
        index * STAGGER_MS,
        withRepeat(
          withSequence(
            withTiming(1, { duration: TRAVEL_MS, easing: Easing.inOut(Easing.cubic) }),
            withTiming(1, { duration: STAGGER_MS * 2 }),
            withTiming(0, { duration: 0 }),
          ),
          -1,
          false,
        ),
      );
    });
    breathe.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // The shared values are stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const megaphone = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(breathe.value, [0, 1], [1, 1.06]) },
      { rotate: `${interpolate(breathe.value, [0, 1], [-4, 2])}deg` },
    ],
  }));

  return (
    <View
      className="mb-2 flex-row items-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <PulseHalo size={64} color={colors["brand-300"]}>
        <Animated.View style={megaphone}>
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <CustomIcon as={Megaphone} size={30} strokeWidth={1.6} className="text-primary" />
          </View>
        </Animated.View>
      </PulseHalo>
      <View className="ml-2 gap-3">
        {lanes.map((lane, index) => (
          <Lane key={index} progress={lane} index={index} still={reduced} />
        ))}
      </View>
    </View>
  );
}

function Lane({
  progress,
  index,
  still,
}: {
  progress: SharedValue<number>;
  index: number;
  still: boolean;
}) {
  // A message along the dashes: fades in, travels, and fades as it lands.
  const message = useAnimatedStyle(() => ({
    opacity: still ? 0 : interpolate(progress.value, [0, 0.12, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, LANE - 14]) }],
  }));
  // The recipient pops as it arrives.
  const recipient = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 0.82, 0.92, 1], [1, 1, 1.15, 1]) }],
  }));
  return (
    <View className="flex-row items-center" style={{ marginLeft: index === 1 ? 0 : 10 }}>
      <View style={{ width: LANE }} className="justify-center">
        <View className="flex-row justify-between px-0.5">
          {[0, 1, 2, 3, 4, 5].map((dash) => (
            <View key={dash} className="h-0.5 w-1.5 rounded-full bg-border" />
          ))}
        </View>
        <Animated.View style={[{ position: "absolute", left: 0 }, message]}>
          <View className="h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
            <CustomIcon
              as={MessageCircle}
              size={8}
              strokeWidth={2.6}
              className="text-primary-foreground"
            />
          </View>
        </Animated.View>
      </View>
      <Animated.View style={recipient}>
        <View
          className={cn(
            "h-9 w-9 items-center justify-center rounded-full border-2 border-card",
            RECIPIENTS[index],
          )}
        >
          <CustomIcon as={UserRound} size={16} className={RECIPIENT_ICON[index]} />
        </View>
      </Animated.View>
    </View>
  );
}
