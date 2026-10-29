import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import {
  KeyboardState,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
} from "react-native-reanimated";

import { keyboardOverlap, revealOffset } from "../utils/keyboard-scroll";

export function useKeyboardScroll(target: RefObject<View | null>) {
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const offset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  // Real keyboard height from the screen bottom (0 = closed or unknown).
  const nativeHeight = useRef(0);
  const animatedKeyboard = useAnimatedKeyboard();
  const frame = useRef<number | null>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardVisible, setKeyboardVisibleState] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const visibleRef = useRef(false);
  // True from the first sign the keyboard is opening until it starts closing.
  const closing = useRef(false);
  const opening = useRef(false);

  // Every visibility change animates the layout (hero, card padding) so the
  // screen eases with the keyboard instead of snapping when it settles.
  const setKeyboardVisible = useCallback((visible: boolean) => {
    if (visibleRef.current === visible) return;
    visibleRef.current = visible;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        220,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
    setKeyboardVisibleState(visible);
  }, []);

  const reveal = useCallback(() => {
    const scroll = scrollRef.current;
    const viewport = viewportRef.current;
    if (!scroll || !viewport) return;
    viewport.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
      if (viewportRef.current !== viewport || viewportHeight <= 0) return;
      // Once the keyboard is closing, ignore the stale frame it still reports.
      const top = closing.current
        ? null
        : (keyboardTop.current ??
          (Platform.OS === "web" ? null : (Keyboard.metrics()?.screenY ?? null)));
      keyboardTop.current = top;
      setKeyboardVisible(top != null || opening.current);
      setKeyboardInset(
        Platform.OS === "web" ? 0 : keyboardOverlap(viewportTop, viewportHeight, top),
      );
      const section = target.current;
      if (!section) return;
      section.measureInWindow((_targetX, targetTop, _targetWidth, targetHeight) => {
        if (target.current !== section || viewportRef.current !== viewport || targetHeight <= 0)
          return;
        const y = revealOffset({
          offset: offset.current,
          viewportTop,
          viewportHeight,
          targetTop,
          targetHeight,
          keyboardTop: keyboardTop.current,
        });
        if (Math.abs(y - offset.current) > 1) scroll.scrollTo({ y, animated: true });
      });
    });
  }, [setKeyboardVisible, target]);

  const scheduleReveal = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    if (settling.current != null) clearTimeout(settling.current);
    frame.current = requestAnimationFrame(reveal);
    // Keyboard and safe-area resizing can settle after the focus event.
    settling.current = setTimeout(reveal, 220);
  }, [reveal]);

  // Android draws edge-to-edge, and React Native's keyboard events come out short by
  // about the navigation bar, which left half of the bottom button under the
  // keyboard. Reanimated reports the true height from the screen bottom, so
  // prefer it over the event coordinates once it is known.
  const topFor = useCallback((eventTop: number) => {
    return nativeHeight.current > 0
      ? Dimensions.get("screen").height - nativeHeight.current
      : eventTop;
  }, []);
  const onNativeHeight = useCallback(
    (height: number) => {
      nativeHeight.current = height;
      if (height > 0) {
        keyboardTop.current = Dimensions.get("screen").height - height;
        scheduleReveal();
      }
    },
    [scheduleReveal],
  );
  // Start easing as soon as the keyboard begins to move, not when it has
  // finished (the hide event only arrives at the end of the slide down).
  const onClosing = useCallback(() => {
    closing.current = true;
    opening.current = false;
    nativeHeight.current = 0;
    keyboardTop.current = null;
    setKeyboardVisible(false);
    setKeyboardInset(0);
  }, [setKeyboardVisible]);
  const onOpening = useCallback(() => {
    closing.current = false;
    opening.current = true;
    setKeyboardVisible(true);
  }, [setKeyboardVisible]);
  useAnimatedReaction(
    () => animatedKeyboard.state.value,
    (state, previous) => {
      if (state === previous) return;
      if (state === KeyboardState.CLOSING) runOnJS(onClosing)();
      else if (state === KeyboardState.OPENING) runOnJS(onOpening)();
    },
    [onClosing, onOpening],
  );
  useAnimatedReaction(
    () =>
      animatedKeyboard.state.value === KeyboardState.OPEN
        ? Math.round(animatedKeyboard.height.value)
        : 0,
    (height, previous) => {
      if (height !== previous) runOnJS(onNativeHeight)(height);
    },
    [onNativeHeight],
  );

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      closing.current = false;
      keyboardTop.current = topFor(event.endCoordinates.screenY);
      scheduleReveal();
    });
    const willShow =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillShow", (event) => {
            closing.current = false;
            keyboardTop.current = topFor(event.endCoordinates.screenY);
            scheduleReveal();
          })
        : null;
    const change =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardDidChangeFrame", (event) => {
            keyboardTop.current = topFor(event.endCoordinates.screenY);
            scheduleReveal();
          })
        : null;
    const hide = Keyboard.addListener("keyboardDidHide", onClosing);
    const willHide =
      Platform.OS === "ios" ? Keyboard.addListener("keyboardWillHide", onClosing) : null;
    // Autofocus/navigation/Fast Refresh can mount this screen after the show
    // event. Recover the current keyboard instead of waiting for another event.
    const initialFrame = requestAnimationFrame(() => {
      scheduleReveal();
    });
    return () => {
      show.remove();
      willShow?.remove();
      change?.remove();
      hide.remove();
      willHide?.remove();
      cancelAnimationFrame(initialFrame);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      if (settling.current != null) clearTimeout(settling.current);
    };
  }, [onClosing, scheduleReveal, topFor]);

  return {
    scrollRef,
    viewportRef,
    keyboardVisible,
    keyboardInset,
    scheduleReveal,
    onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
      offset.current = event.nativeEvent.contentOffset.y;
    },
  };
}
