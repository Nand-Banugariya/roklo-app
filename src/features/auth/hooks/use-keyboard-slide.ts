import { useEffect, useState, type RefObject } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  KeyboardState,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Room kept between the revealed part (Send code, the code boxes) and the keyboard.
const KEYBOARD_GAP = 23;
// A phone keyboard with its toolbar covers up to about 44% of the screen: open, the target ends above
// this share of the screen's height. Half the screen left a wide empty strip of card under Send code;
// 55% with a 16 gap left it close against the keyboard's toolbar.
const KEYBOARD_TOP_SHARE = 0.56;
// How long the floor takes to ease in and out, about a keyboard's own animation.
const OPEN_MS = 250;
const CLOSE_MS = 200;

/**
 * Slides a page up with the keyboard on the UI thread, frame by frame, by just enough to keep `target`
 * (else the focused input) above it; never further than the keyboard. Only a transform changes while the
 * keyboard moves: no layout, measuring or scrolling then, which made the sign-in fields jump up and down.
 * The target is measured with the page at rest (on layout, after a scroll) and as the keyboard starts
 * to rise.
 */
export function useKeyboardSlide(target?: RefObject<View | null>) {
  // Measured from the screen's bottom edge, as the chat composer reads it (see KeyboardScreen). With
  // Reanimated's Android defaults it came out short by the navigation bar, leaving Send code under the
  // keyboard (and those defaults also shift the whole layout).
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const { bottom: safeBottom } = useSafeAreaInsets();
  // A second opinion once the keyboard is up: the system's own height (Android's is short by the navigation
  // bar, so that's added back). The larger one is used, so Send code ends above the keyboard even where
  // one source reports too little.
  const settledHeight = useSharedValue(0);
  // 0 closed, 1 open, eased: brings in the floor below (see `lift`) when any source says the keyboard is up.
  const open = useSharedValue(0);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) => {
      settledHeight.set(event.endCoordinates.height + (Platform.OS === "android" ? safeBottom : 0));
      open.set(withTiming(1, { duration: OPEN_MS }));
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      settledHeight.set(0);
      open.set(withTiming(0, { duration: CLOSE_MS }));
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [safeBottom, settledHeight, open]);
  // If a device does shrink the window for the keyboard, that part is already out of the way.
  const [heights, setHeights] = useState({ full: 0, current: 0 });
  const resized = Math.max(0, heights.full - heights.current);
  // Where the part to keep visible ends (screen y, page at rest), and the screen's height; 0 until measured.
  const targetBottom = useSharedValue(0);
  const screenHeight = useSharedValue(0);
  const lift = useDerivedValue(() => {
    if (targetBottom.value <= 0 || screenHeight.value <= 0) return 0;
    const state = keyboard.state.value;
    // While it closes, only the live height: the settled one would hold the page up until it's down.
    const closing = state === KeyboardState.CLOSING || state === KeyboardState.CLOSED;
    const height = Math.max(
      0,
      Math.max(keyboard.height.value, closing ? 0 : settledHeight.value) - resized,
    );
    const space = screenHeight.value - targetBottom.value - KEYBOARD_GAP;
    const byKeyboard = Math.min(height, Math.max(0, height - space));
    // The floor: open, the target always ends above the top KEYBOARD_TOP_SHARE of the screen, whatever the
    // keyboard is said to measure. Expo Go on Android reports it unreliably (the old login never measured
    // it for that reason), which left Send code under the keyboard.
    const byShare = Math.max(
      0,
      targetBottom.value - (screenHeight.value * KEYBOARD_TOP_SHARE - KEYBOARD_GAP),
    );
    return Math.max(byKeyboard, byShare * open.value);
  });
  // A transform only: the page doesn't re-lay out while it moves.
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value }],
  }));

  // Plain functions: the React Compiler (on in app.json) keeps them stable between renders.
  const measure = () => {
    const node = target?.current ?? (TextInput.State.currentlyFocusedInput() as View | null);
    if (!node) return;
    node.measureInWindow((_x, y, _width, height) => {
      if (height <= 0) return;
      screenHeight.set(Dimensions.get("screen").height);
      // Measured where it is now: take back the slide it already has, for its place at rest.
      targetBottom.set(y + height + lift.value);
    });
  };
  // Measured again as the keyboard starts to rise (its focused input is known by then), and once it's up.
  useAnimatedReaction(
    () => keyboard.state.value,
    (state, previous) => {
      if (state === previous) return;
      if (state === KeyboardState.OPENING || state === KeyboardState.OPEN) {
        // The floor eases in alongside the keyboard where its state is reported, else on keyboardDidShow.
        open.set(withTiming(1, { duration: OPEN_MS }));
        runOnJS(measure)();
      } else if (state === KeyboardState.CLOSING) open.set(withTiming(0, { duration: CLOSE_MS }));
    },
    [measure],
  );

  /** The page's outer frame: its height (for a window the keyboard shrinks) and a fresh measure. */
  const onFrameLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setHeights((old) => ({
      full: Math.max(old.full, height),
      current: height,
    }));
    measure();
  };

  return { slide, measure, onFrameLayout };
}
