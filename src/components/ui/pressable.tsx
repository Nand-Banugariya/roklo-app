import { useState, type ComponentProps } from "react";
import {
  Pressable as NativePressable,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { pressedStyle } from "@/lib/pressed-style";

const ACTIVE = "active:";

/** Splits "px-4 active:bg-accent" into its resting classes and its pressed ones (without the prefix). */
function split(className: string | undefined) {
  const base: string[] = [];
  const pressed: string[] = [];
  for (const token of (className ?? "").split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith(ACTIVE)) pressed.push(token.slice(ACTIVE.length));
    else base.push(token);
  }
  return { base: base.join(" "), pressed };
}

type Props = ComponentProps<typeof NativePressable>;

/**
 * How long a finger rests before the pressed look shows, as on WhatsApp: a touch that turns into a scroll
 * within it never highlights the row it started on. Taps still fire as usual.
 */
const PRESS_DELAY_MS = 100;

/**
 * React Native's Pressable, with `active:` classes driven by its own press events. NativeWind's
 * `active:` state could stay on after a press that opened another screen, leaving the row looking
 * pressed when you came back. Pressability always pairs press-in with press-out (also when a scroll
 * or navigation cancels the touch), so the pressed look always clears.
 *
 * The className never changes while pressing: NativeWind re-creates a component whose classes gain
 * new kinds of style after the first render, and its dev warning crashes on navigation props. The
 * pressed look goes on as an inline style from the theme instead (lib/pressed-style.ts). Keep
 * transition or animation classes off pressables: they make the view animated, and an animated view
 * keeps an inline style after it's removed, so the pressed look would never clear.
 */
export function Pressable({
  className,
  onPressIn,
  onPressOut,
  disabled,
  style,
  unstable_pressDelay,
  ...props
}: Props) {
  const { colors } = useRokloTheme();
  const [pressed, setPressed] = useState(false);
  const classes = split(className);
  const active =
    pressed && !disabled && classes.pressed.length ? pressedStyle(classes.pressed, colors) : null;
  const merged: Props["style"] =
    typeof style === "function"
      ? (state: PressableStateCallbackType) => [style(state), active] as StyleProp<ViewStyle>
      : [style, active];
  return (
    <NativePressable
      {...props}
      disabled={disabled}
      className={classes.base}
      style={merged}
      unstable_pressDelay={
        unstable_pressDelay ?? (classes.pressed.length ? PRESS_DELAY_MS : undefined)
      }
      onPressIn={(event) => {
        if (classes.pressed.length) setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
    />
  );
}
