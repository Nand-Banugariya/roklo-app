import { useEffect, useRef } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";

import {
  ROKLO_BUBBLE_PATH,
  ROKLO_GLYPH_STROKE_PATH,
  ROKLO_HANDLE_PATH,
  ROKLO_MEGAPHONE_PATH,
  ROKLO_TAIL_PATH,
  ROKLO_TEXT_PATH,
} from "@/components/brand/roklo-wordmark";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";

import { AuthBackdrop } from "./auth-backdrop";

/** The intro plays once per app launch, before the first login screen. */
export const introState = { played: false };

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Timeline in milliseconds. Part one is a short chat; part two is the logo.
const REPLY_IN_AT = 80;
const REPLY_OUT_AT = 360;
const TICKS_AT = 700;
const TYPING_AT = 780;
const STACK_EXIT_AT = 1150;
const STACK_EXIT_MS = 300;

const LOGO_AT = 1100;
const DRAW_AT = LOGO_AT + 380;
const DRAW_MS = 560;
const FILL_AT = DRAW_AT + DRAW_MS - 80;
// The mark shrinks to its place in the full logo and the name slides out.
const SETTLE_AT = FILL_AT + 60;
const SETTLE_MS = 620;
const TEXT_AT = SETTLE_AT + 140;
const TEXT_MS = 620;
// Once the name is out the logo fades into the same tinted backdrop that the
// login page uses, then login follows.
const EXIT_AT = TEXT_AT + TEXT_MS + 120;
const EXIT_MS = 260;
const REDUCED_HOLD = 700;

// Longer than the glyph outline, so a dash this long draws it in one stroke.
const GLYPH_LENGTH = 1300;

/** A chat bubble that pops in from the side it belongs to. */
function Bubble({
  side,
  delay,
  width,
  lines,
  bubbleColor,
  lineColor,
  borderColor,
  ticks,
}: {
  side: "in" | "out";
  delay: number;
  width: number;
  /** Width of each placeholder text line, as a share of the bubble. */
  lines: number[];
  bubbleColor: string;
  lineColor: string;
  borderColor?: string;
  ticks?: { color: string; at: number };
}) {
  const progress = useSharedValue(0);
  const tick = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 190, mass: 0.7 }));
    if (ticks) tick.value = withDelay(ticks.at, withTiming(1, { duration: 220 }));
  }, [delay, progress, tick, ticks]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.8),
    transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.7 + progress.value * 0.3 }],
  }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: tick.value,
    transform: [{ scale: 0.6 + tick.value * 0.4 }],
  }));
  const out = side === "out";
  return (
    <Animated.View
      style={[
        {
          alignSelf: out ? "flex-end" : "flex-start",
          width,
          gap: 7,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 18,
          borderBottomLeftRadius: out ? 18 : 5,
          borderBottomRightRadius: out ? 5 : 18,
          backgroundColor: bubbleColor,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          transformOrigin: out ? "right bottom" : "left bottom",
        },
        style,
      ]}
    >
      {lines.map((share, index) => (
        <View
          key={index}
          style={{
            width: `${share * 100}%`,
            height: 7,
            borderRadius: 4,
            backgroundColor: lineColor,
          }}
        />
      ))}
      {ticks && (
        <Animated.View style={[{ alignSelf: "flex-end" }, tickStyle]}>
          <Svg width={18} height={12} viewBox="0 0 18 12" fill="none">
            <Path
              d="M1 6.5L4.5 10L11 2M7 8.5L8.5 10L15 2"
              stroke={ticks.color}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function Dot({ index, color }: { index: number; color: string }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = withDelay(
      TYPING_AT + 120 + index * 110,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
        ),
        3,
        false,
      ),
    );
  }, [index, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]}
    />
  );
}

/** "Someone is typing…" bubble, the cue that the next message is coming. */
function Typing({
  bubbleColor,
  dotColor,
  borderColor,
}: {
  bubbleColor: string;
  dotColor: string;
  borderColor: string;
}) {
  const visible = useSharedValue(0);
  useEffect(() => {
    visible.value = withDelay(TYPING_AT, withSpring(1, { damping: 12, stiffness: 190, mass: 0.7 }));
  }, [visible]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, visible.value * 1.8),
    transform: [{ translateY: (1 - visible.value) * 14 }, { scale: 0.7 + visible.value * 0.3 }],
  }));
  return (
    <Animated.View
      style={[
        {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 14,
          paddingVertical: 13,
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          backgroundColor: bubbleColor,
          borderWidth: 1,
          borderColor,
          transformOrigin: "left bottom",
        },
        style,
      ]}
    >
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} color={dotColor} />
      ))}
    </Animated.View>
  );
}

/**
 * Animated Roklo intro about messaging: a customer message arrives, the team
 * replies (double tick), a typing bubble appears, then the chat turns into the
 * Roklo logo mark. The megaphone is drawn stroke by stroke. Tap to skip. With
 * reduced motion it only holds the finished mark briefly.
 */
export function AuthIntro({ onDone, tinted = true }: { onDone: () => void; tinted?: boolean }) {
  const { colors } = useRokloTheme();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  // The finished logo is the mark and the name side by side. Sizes come from
  // the logo artwork: mark 640 x 620, a 150 gap, name 2269 x 469 (3059 wide).
  const unit = Math.min(width * 0.72, 320) / 3059;
  const markW = 640 * unit;
  const markH = 620 * unit;
  const gap = 150 * unit;
  const textW = 2269 * unit;
  const textH = 469 * unit;
  const rowW = 3059 * unit;
  // First the mark stands alone, large and centred; it settles from there.
  const bigScale = Math.min(width * 0.38, 160) / markH;
  const centreShift = (rowW - markW) / 2;
  const stackWidth = Math.min(width * 0.68, 280);

  const markScale = useSharedValue(reduced ? 1 : 0.35);
  const markOpacity = useSharedValue(reduced ? 1 : 0);
  const draw = useSharedValue(reduced ? 0 : GLYPH_LENGTH);
  const fill = useSharedValue(reduced ? 1 : 0);
  const settle = useSharedValue(reduced ? 1 : 0);
  const text = useSharedValue(reduced ? 1 : 0);
  const stack = useSharedValue(1);
  const exit = useSharedValue(1);

  useEffect(() => {
    if (!reduced) {
      stack.value = withDelay(
        STACK_EXIT_AT,
        withTiming(0, {
          duration: STACK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        }),
      );
      markOpacity.value = withDelay(LOGO_AT, withTiming(1, { duration: 260 }));
      markScale.value = withDelay(
        LOGO_AT,
        withSpring(1, { damping: 11, stiffness: 150, mass: 0.8 }),
      );
      draw.value = withDelay(
        DRAW_AT,
        withTiming(0, {
          duration: DRAW_MS,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
      fill.value = withDelay(FILL_AT, withTiming(1, { duration: 220 }));
      settle.value = withDelay(
        SETTLE_AT,
        withTiming(1, {
          duration: SETTLE_MS,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
      text.value = withDelay(
        TEXT_AT,
        withTiming(1, { duration: TEXT_MS, easing: Easing.out(Easing.cubic) }),
      );
      exit.value = withDelay(
        EXIT_AT,
        withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.quad) }),
      );
    }
    const timer = setTimeout(finish, reduced ? REDUCED_HOLD : EXIT_AT + EXIT_MS);
    return () => clearTimeout(timer);
    // The timeline is set up once for the screen's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [
      { translateX: centreShift * (1 - settle.value) },
      {
        scale: markScale.value * (bigScale + (1 - bigScale) * settle.value),
      },
    ],
  }));
  // The name starts hidden behind the mark and slides out to the right.
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateX: -textW * 0.5 * (1 - text.value) }],
  }));
  const stackStyle = useAnimatedStyle(() => ({
    opacity: stack.value,
    transform: [{ scale: 0.8 + stack.value * 0.2 }],
  }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: exit.value }));
  const drawProps = useAnimatedProps(() => ({
    strokeDashoffset: draw.value,
  }));
  const fillProps = useAnimatedProps(() => ({ opacity: fill.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Roklo. Tap to continue."
      onPress={finish}
      className={cn("flex-1", tinted ? "bg-brand-100" : "bg-background")}
    >
      <AuthBackdrop />
      <Animated.View
        style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, screenStyle]}
      >
        <View
          style={{
            width: rowW,
            height: markH,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {!reduced && (
            // The chat sits centred, where the mark appears.
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View style={[{ width: stackWidth, gap: 10 }, stackStyle]}>
                <Bubble
                  side="in"
                  delay={REPLY_IN_AT}
                  width={stackWidth * 0.8}
                  lines={[0.9, 0.55]}
                  bubbleColor={colors.card}
                  borderColor={colors.border}
                  lineColor={colors["ink-300"]}
                />
                <Bubble
                  side="out"
                  delay={REPLY_OUT_AT}
                  width={stackWidth * 0.64}
                  lines={[0.85]}
                  bubbleColor={colors["logo-mark"]}
                  lineColor="rgba(255,255,255,0.75)"
                  ticks={{ color: colors["logo-glyph"], at: TICKS_AT }}
                />
                <Typing
                  bubbleColor={colors.card}
                  borderColor={colors.border}
                  dotColor={colors["ink-300"]}
                />
              </Animated.View>
            </View>
          )}
          <Animated.View style={[{ zIndex: 1 }, markStyle]}>
            <Svg width={markW} height={markH} viewBox="330 30 640 620" fill="none">
              <Path d={ROKLO_BUBBLE_PATH} fill={colors["logo-mark"]} />
              <Ellipse
                cx="651.341"
                cy="341.281"
                rx="253.657"
                ry="248.743"
                fill={colors["logo-mark"]}
              />
              <Path d={ROKLO_TAIL_PATH} fill={colors["logo-mark"]} />
              <AnimatedPath
                d={ROKLO_MEGAPHONE_PATH}
                fill={colors["logo-glyph"]}
                animatedProps={fillProps}
              />
              <AnimatedPath
                d={ROKLO_HANDLE_PATH}
                fill={colors["logo-glyph"]}
                animatedProps={fillProps}
              />
              <AnimatedPath
                d={ROKLO_GLYPH_STROKE_PATH}
                stroke={colors["logo-glyph"]}
                strokeWidth={44.9186}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[GLYPH_LENGTH]}
                animatedProps={drawProps}
              />
            </Svg>
          </Animated.View>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: markW + gap,
                // The name's centre sits 12.5 artwork units above the mark's.
                top: (markH - textH) / 2 + 12.5 * unit,
              },
              textStyle,
            ]}
          >
            <Svg width={textW} height={textH} viewBox="1120 93 2269 469" fill="none">
              <Path d={ROKLO_TEXT_PATH} fill={colors["logo-text"]} />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
