import { useEffect, type PropsWithChildren } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** Shared 0 → 1 loop; stays at 0 when the system asks for reduced motion. */
function useLoop(duration: number) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress, reducedMotion]);
  return { progress, reducedMotion };
}

/** A single soft ring that breathes out from a status dot or icon. Style-only, so no class names reach Reanimated. */
export function PulseHalo({
  size,
  color,
  children,
}: PropsWithChildren<{ size: number; color: string }>) {
  const { progress, reducedMotion } = useLoop(1800);
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 2.1]) }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {!reducedMotion && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
            ring,
          ]}
        />
      )}
      {children}
    </View>
  );
}
