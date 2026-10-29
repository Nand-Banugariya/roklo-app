import { Mic } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

/** One of three dots rising in turn, 1.2s a cycle as on the web app; still under reduced motion. */
function Dot({ index, color }: { index: number; color: string }) {
  const reduced = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    lift.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 300 }),
          withTiming(0, { duration: 300 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
      ),
    );
  }, [reduced, index, lift]);
  // Style only: Reanimated never receives NativeWind class names.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
    opacity: 0.55 + (-lift.value / 3) * 0.45,
  }));
  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]}
    />
  );
}

/** The customer is typing or recording a voice note: a bubble with dots ends the thread, as on the web app. */
export function TypingBubble({ activity }: { activity: "typing" | "recording" }) {
  const { colors } = useRokloTheme();
  return (
    <View
      accessibilityLabel={activity === "recording" ? "Recording audio" : "Typing"}
      accessibilityLiveRegion="polite"
      className="mt-2 px-3"
    >
      <View className="h-9 flex-row items-center gap-1.5 self-start rounded-2xl rounded-tl-[4px] bg-bubble-in px-3.5 shadow-sm shadow-black/5">
        {activity === "recording" && <CustomIcon as={Mic} size={14} className="text-brand-600" />}
        {[0, 1, 2].map((index) => (
          <Dot key={index} index={index} color={colors["ink-500"]} />
        ))}
      </View>
    </View>
  );
}
