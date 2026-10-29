import type { ComponentProps } from "react";
import { Pressable } from "@/components/ui/pressable";
import { useReducedMotion } from "react-native-reanimated";
import { cn } from "@/lib/utils";

/**
 * A Pressable with the touch feedback: it scales to 0.98 while pressed (not under reduced motion).
 * No transition classes: they make NativeWind render an animated view, and an animated view keeps a
 * style that's taken away, so a row's pressed background stayed on after the press (and after
 * coming back from the chat it opened). The scale and colour go on and off as inline styles (Pressable).
 */
export function MotionPressable({ className, ...props }: ComponentProps<typeof Pressable>) {
  const reducedMotion = useReducedMotion();
  return (
    <Pressable {...props} className={cn(!reducedMotion && "active:scale-[0.98]", className)} />
  );
}
