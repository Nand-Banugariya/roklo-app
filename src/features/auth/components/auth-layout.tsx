import { Link } from "expo-router";
import { CircleHelp } from "lucide-react-native";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Platform, ScrollView, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { RokloWordmark } from "@/components/brand/roklo-wordmark";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { env } from "@/config/env";

import { cn } from "@/lib/utils";
import { useKeyboardScroll } from "../hooks/use-keyboard-scroll";
import { AuthBackdrop } from "./auth-backdrop";

// A phone keyboard with its toolbar covers up to about 45% of the screen. The
// card and header must end above this share of the window height.
const KEYBOARD_TOP_SHARE = 0.55;
// Top padding, wordmark and the gap under it on the pinned page.
const PINNED_HEADER = 64;
const MIN_KEYBOARD_HERO = 56;
const MAX_KEYBOARD_HERO = 260;

export function AuthLayout({
  children,
  focusTargetRef,
  hero,
  tinted = false,
  scrollable = true,
  showHelp = true,
  cornerLogo = false,
}: {
  children:
    | ReactNode
    | ((reveal: () => void, keyboardVisible: boolean) => ReactNode);
  focusTargetRef?: RefObject<View | null>;
  /**
   * Shown under the wordmark. On the pinned page it stays visible with the
   * keyboard open (pass a function to get `keyboardVisible` and show a
   * compact version); on the scrolling page it is hidden then.
   */
  hero?: ReactNode | ((keyboardVisible: boolean) => ReactNode);
  /** Fills the screen with the light brand colour, e.g. behind the carousel. */
  tinted?: boolean;
  /**
   * False pins the page: no user scrolling (keyboard reveal still works), the
   * wordmark and hero fill the top and the children sit on the bottom edge.
   */
  scrollable?: boolean;
  /** Shows the "Need help signing in?" link under the content. */
  showHelp?: boolean;
  /** Puts the wordmark in the top-left corner, as on the pinned login page. */
  cornerLogo?: boolean;
}) {
  const fallbackTargetRef = useRef<View>(null);
  const {
    scrollRef,
    viewportRef,
    keyboardVisible,
    keyboardInset,
    scheduleReveal,
    onScroll,
  } = useKeyboardScroll(focusTargetRef ?? fallbackTargetRef);
  // Lift the page by the keyboard's real height, frame by frame, like the chat
  // composer (see KeyboardScreen). Android draws edge-to-edge, so the window does
  // not shrink and measured coordinates came out short by the navigation bar,
  // leaving half of the Send code button under the keyboard.
  const keyboard = useAnimatedKeyboard();
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const [heights, setHeights] = useState({ full: 0, current: 0 });
  // If a device does shrink the window, do not lift by that part twice.
  const resized = Math.max(0, heights.full - heights.current);
  // The pinned page reaches the bottom edge; the scrolling one keeps the inset.
  const insetBelow = scrollable ? safeBottom : 0;
  // Second opinion from measured coordinates (Android is short by the navigation
  // bar, so add it back). Taking the larger of the two means Send code stays
  // above the keyboard even if one source reports nothing on some device.
  const measured =
    keyboardInset > 0
      ? keyboardInset + (Platform.OS === "android" ? safeBottom : 0)
      : 0;
  const lift = useAnimatedStyle(() => ({
    // The pinned page is laid out from the top (see `pinnedKeyboard`) and its
    // card runs down behind the keyboard, so lifting would only open a gap.
    paddingBottom: scrollable
      ? Math.max(0, keyboard.height.value - insetBelow - resized, measured)
      : 0,
  }));
  const content =
    typeof children === "function"
      ? children(scheduleReveal, keyboardVisible)
      : children;
  // Pinned page with the keyboard open: stack wordmark, a short hero strip and
  // the card from the top. Nothing here depends on measuring the keyboard, which
  // Expo Go on Android reports unreliably, so Send code always sits above it.
  const { height: windowHeight } = useWindowDimensions();
  const [cardHeight, setCardHeight] = useState(300);
  const pinnedKeyboard = !scrollable && keyboardVisible;
  const keyboardHeroHeight = Math.min(
    MAX_KEYBOARD_HERO,
    Math.floor(
      windowHeight * KEYBOARD_TOP_SHARE - safeTop - PINNED_HEADER - cardHeight,
    ),
  );
  return (
    <View className={cn("flex-1", tinted ? "bg-brand-100" : "bg-ink-50")}>
      <AuthBackdrop />
      {/* Pinned children reach the bottom edge and pad the inset themselves. */}
      <SafeAreaView
        className="flex-1"
        edges={scrollable ? undefined : ["top", "left", "right"]}
      >
        <View
          ref={viewportRef}
          collapsable={false}
          style={{ flex: 1 }}
          onLayout={({ nativeEvent }) => {
            const height = nativeEvent.layout.height;
            setHeights((old) => ({
              full: Math.max(old.full, height),
              current: height,
            }));
            scheduleReveal();
          }}
        >
          <Animated.View style={[{ flex: 1 }, lift]}>
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              // A pinned page still scrolls with the keyboard open, so a short
              // phone can never leave the main button under the keyboard.
              scrollEnabled={scrollable || keyboardVisible}
              bounces={scrollable}
              showsVerticalScrollIndicator={scrollable}
              onLayout={scheduleReveal}
              onContentSizeChange={scheduleReveal}
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ flexGrow: 1 }}
              contentContainerClassName="items-center"
            >
              <View
                className={cn(
                  "w-full max-w-[520px] px-5 pt-7 sm:px-8 sm:pt-10",
                  scrollable && "pb-4",
                )}
                // With the keyboard open on the pinned page the stack keeps its
                // natural height from the top, so the card is never pushed down.
                style={{ flexGrow: pinnedKeyboard ? 0 : 1, flexShrink: 0 }}
              >
                {/* Pinned: the wordmark sits in the top-left corner, outside
                    the centred hero, so it stays put on every screen height. */}
                {(!scrollable || cornerLogo) && (
                  <View
                    className={cn(
                      "items-start",
                      // Verification keeps the logo in normal flow, reserving
                      // its full height before the back link and heading.
                      !scrollable && "-ml-1 -mt-3",
                    )}
                  >
                    <RokloWordmark width={scrollable ? 180 : 207} height={scrollable ? 33 : 38} />
                  </View>
                )}
                <View
                  className={cn(
                    "justify-center py-8",
                    !pinnedKeyboard && !(scrollable && cornerLogo) && "grow",
                    (keyboardVisible || !scrollable) && "py-4",
                    // Keyboard open on the pinned page: the hero peeks out
                    // above the card, so no gap is left between them.
                    pinnedKeyboard && "pb-0 pt-2",
                    scrollable && cornerLogo && "pb-4 pt-6",
                  )}
                >
                  {hero && !scrollable && (
                    // One wrapper stays mounted through the keyboard change so
                    // the carousel keeps its slide and the height animates.
                    // Closed: the hero takes all the space above the card.
                    // `flex-1` is `flex: 1 1 0%`; in this auto-height column the
                    // percentage basis resolves to the content size, so a
                    // numeric zero basis is used. Open: a fixed short strip.
                    <View
                      className={cn(keyboardVisible && "overflow-hidden")}
                      style={
                        pinnedKeyboard
                          ? {
                              flexGrow: 0,
                              flexShrink: 0,
                              height:
                                keyboardHeroHeight >= MIN_KEYBOARD_HERO
                                  ? keyboardHeroHeight
                                  : 0,
                            }
                          : {
                              flexGrow: 1,
                              flexShrink: 1,
                              flexBasis: 0,
                              minHeight: 0,
                            }
                      }
                    >
                      {typeof hero === "function"
                        ? hero(keyboardVisible)
                        : hero}
                    </View>
                  )}
                  {scrollable && !cornerLogo && (
                    <View
                      className={cn(
                        "mb-10 items-center",
                        keyboardVisible && "mb-6",
                      )}
                    >
                      <RokloWordmark width={207} height={38} />
                    </View>
                  )}
                  {hero && scrollable && !keyboardVisible && (
                    <View className="-mt-2 mb-8">
                      {typeof hero === "function" ? hero(false) : hero}
                    </View>
                  )}
                  {scrollable && content}
                </View>
                {!scrollable && (
                  <View
                    onLayout={({ nativeEvent }) => {
                      if (pinnedKeyboard)
                        setCardHeight(Math.round(nativeEvent.layout.height));
                    }}
                  >
                    {content}
                  </View>
                )}
                {showHelp && (
                  <Link href={`${env.webUrl}/help`} asChild>
                    <CustomButton
                      variant="link"
                      size="sm"
                      className="mt-6 self-center"
                      leadingIcon={
                        <CustomIcon
                          as={CircleHelp}
                          size={15}
                          className="text-ink-700"
                        />
                      }
                    >
                      <CustomText className="font-sans text-[13px] text-ink-700 no-underline">
                        Need help signing in?
                      </CustomText>
                    </CustomButton>
                  </Link>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
