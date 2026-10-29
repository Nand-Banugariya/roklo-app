import {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

/**
 * Small Reanimated transitions for content that opens in place: panels slide in, menus fade in,
 * and whatever sits around them glides to its new spot. All off when the OS asks for reduced motion.
 */
export function useSmoothMotion() {
  const reduced = useReducedMotion();
  if (reduced) return { panel: {}, menu: {}, layout: undefined };
  return {
    panel: { entering: FadeInDown.duration(220), exiting: FadeOut.duration(140) },
    menu: { entering: FadeIn.duration(140), exiting: FadeOut.duration(100) },
    layout: LinearTransition.duration(220),
  };
}
