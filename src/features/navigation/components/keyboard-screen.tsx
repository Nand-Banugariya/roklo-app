import { useFocusEffect } from "expo-router";
import { useCallback, useState, type PropsWithChildren } from "react";
import { Keyboard, Platform, View } from "react-native";
import Animated, { KeyboardState, useAnimatedKeyboard, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Keeps a screen's bottom input just above the keyboard on iOS and Android, rising with it frame by
 * frame like WhatsApp. Android draws edge-to-edge, so the window no longer shrinks for the keyboard and
 * KeyboardAvoidingView's coordinate maths came out short by about the navigation bar, leaving half the
 * composer under the keyboard. Reanimated reports the keyboard's real height from the screen bottom;
 * the app shell already keeps the bottom safe-area inset below this screen, so that part isn't padded
 * twice. If a device does shrink the window for the keyboard, the shrink is subtracted so the input
 * isn't lifted twice. (`useAnimatedKeyboard` is deprecated in favour of react-native-keyboard-controller,
 * which isn't in Expo Go.)
 */
export function KeyboardScreen({ children, className }: PropsWithChildren<{ className?: string }>) {
  // AppShell owns the system-bar insets. Reanimated's default Android margins
  // otherwise move the entire stack when this chat mounts and unmounts.
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const focused = useSharedValue(false);
  const visible = useSharedValue(false);
  const { bottom } = useSafeAreaInsets();
  useFocusEffect(useCallback(() => {
    focused.set(true);
    // A popped native screen can leave Reanimated's observer at OPEN with its
    // last height. Each visit starts with the keyboard dismissed, not that cache.
    visible.set(false);
    Keyboard.dismiss();
    const show = () => { visible.set(true); };
    const hide = () => { visible.set(false); };
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", hide),
    ];
    if (Platform.OS === "ios") {
      subscriptions.push(Keyboard.addListener("keyboardWillShow", show));
    }
    return () => {
      focused.set(false);
      visible.set(false);
      subscriptions.forEach((subscription) => subscription.remove());
      // Runs for header back, hardware back, gestures and pushed detail screens.
      Keyboard.dismiss();
    };
  }, [focused, visible]));
  // Tallest height seen (keyboard closed) and the current one: their difference is a system resize.
  const [heights, setHeights] = useState({ full: 0, current: 0 });
  const resized = Math.max(0, heights.full - heights.current);
  // Style only: Reanimated never receives NativeWind class names.
  const lift = useAnimatedStyle(() => ({
    paddingBottom: focused.value && (visible.value || keyboard.state.value === KeyboardState.OPENING)
      ? Math.max(0, keyboard.height.value - bottom - resized)
      : 0,
  }));
  return <View className={className ?? "flex-1"} onLayout={({ nativeEvent }) => {
    const height = nativeEvent.layout.height;
    setHeights((old) => ({ full: Math.max(old.full, height), current: height }));
  }}>
    <Animated.View style={[{ flex: 1 }, lift]}>{children}</Animated.View>
  </View>;
}
