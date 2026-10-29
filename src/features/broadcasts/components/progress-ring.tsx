import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** How much has gone out: sent in green, then failed in red, round a soft track; the share in the middle. */
export function ProgressRing({
  sent,
  failed,
  total,
  size = 132,
  stroke = 12,
}: {
  sent: number;
  failed: number;
  total: number;
  size?: number;
  stroke?: number;
}) {
  const { colors } = useRokloTheme();
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const sentShare = total > 0 ? Math.min(1, sent / total) : 0;
  const failedShare = total > 0 ? Math.min(1 - sentShare, failed / total) : 0;
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) grow.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [grow, reduced]);
  const sentProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - sentShare * grow.value),
  }));
  const failedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - failedShare * grow.value),
  }));
  const pct = Math.round(sentShare * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${pct}% sent`}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors["ink-150"]}
          strokeWidth={stroke}
          fill="none"
        />
        {failedShare > 0 && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors["error-solid"]}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={length}
            animatedProps={failedProps}
            transform={`rotate(${sentShare * 360} ${size / 2} ${size / 2})`}
          />
        )}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={length}
          animatedProps={sentProps}
        />
      </Svg>
      <CustomText className="font-sans-semibold text-[28px] leading-8 tracking-[-1px]">
        {total > 0 ? `${pct}%` : "—"}
      </CustomText>
      <CustomText className="text-[11px] text-muted-foreground">sent</CustomText>
    </View>
  );
}
