import { useEffect, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { keyboardViewport } from "@/lib/keyboard-viewport";

/** Visible bounds for portalled controls, which sit outside form keyboard avoidance. */
export function useKeyboardViewport(enabled: boolean) {
  const { width, height } = useWindowDimensions();
  const safeArea = useSafeAreaInsets();
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() =>
    Platform.OS === "web" ? null : (Keyboard.metrics()?.screenY ?? null),
  );
  const [browserViewport, setBrowserViewport] = useState<{
    top: number;
    bottom: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === "web") {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const update = () =>
        setBrowserViewport({
          top: viewport.offsetTop,
          bottom: viewport.offsetTop + viewport.height,
        });
      viewport.addEventListener("resize", update);
      viewport.addEventListener("scroll", update);
      const frame = requestAnimationFrame(update);
      return () => {
        cancelAnimationFrame(frame);
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
      };
    }

    let receivedEvent = false;
    const show = (event: KeyboardEvent) => {
      receivedEvent = true;
      setKeyboardTop(event.endCoordinates.screenY);
    };
    const hide = () => {
      receivedEvent = true;
      setKeyboardTop(null);
    };
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", hide),
    ];
    if (Platform.OS === "ios") {
      subscriptions.push(
        Keyboard.addListener("keyboardWillShow", show),
        Keyboard.addListener("keyboardWillChangeFrame", show),
        Keyboard.addListener("keyboardDidChangeFrame", show),
      );
    }
    // Opening while a keyboard is already up does not emit another show event.
    const frame = requestAnimationFrame(() => {
      if (!receivedEvent) setKeyboardTop(Keyboard.metrics()?.screenY ?? null);
    });
    return () => {
      cancelAnimationFrame(frame);
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [enabled]);

  // RN Web may report the visual viewport as its window height while fixed
  // portals still occupy the layout viewport. Keep both coordinate spaces.
  const windowHeight =
    Platform.OS === "web" && typeof window !== "undefined" ? window.innerHeight : height;
  const screenHeight = Platform.OS === "web" ? windowHeight : Dimensions.get("screen").height;
  const bounds = keyboardViewport({
    screenHeight,
    windowHeight,
    keyboardTop: enabled ? keyboardTop : null,
    viewportTop: enabled ? browserViewport?.top : undefined,
    viewportBottom: enabled ? browserViewport?.bottom : undefined,
    safeTop: safeArea.top,
    safeBottom: safeArea.bottom,
  });
  return { ...bounds, width, windowHeight };
}
