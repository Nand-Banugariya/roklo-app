import { Link } from "expo-router";
import { CircleHelp } from "lucide-react-native";
import type { ReactNode, RefObject } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { RokloWordmark } from "@/components/brand/roklo-wordmark";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { env } from "@/config/env";

import { cn } from "@/lib/utils";
import { useKeyboardSlide } from "../hooks/use-keyboard-slide";
import { AuthBackdrop } from "./auth-backdrop";

/**
 * The sign-in pages' frame. With the keyboard open the page keeps its layout and slides up on the UI
 * thread, frame by frame with the keyboard, by just enough to keep `focusTargetRef` (else the focused
 * input) above it. Nothing is re-laid out, re-measured or scrolled while the keyboard moves: changing the
 * layout, re-centring on a growing padding and several animated scrolls fighting each other made the
 * fields jump up and down.
 */
export function AuthLayout({
  children,
  focusTargetRef,
  hero,
  tinted = false,
  scrollable = true,
  showHelp = true,
  cornerLogo = false,
}: {
  /** Or a function given `reveal`: call it when what should stay visible moves (e.g. on focus). */
  children: ReactNode | ((reveal: () => void) => ReactNode);
  /** What stays above the keyboard; without it, the focused input. */
  focusTargetRef?: RefObject<View | null>;
  /** Shown under the wordmark. */
  hero?: ReactNode;
  /** Fills the screen with the light brand colour, e.g. behind the carousel. */
  tinted?: boolean;
  /**
   * False pins the page: no user scrolling, the wordmark and hero fill the top and the children sit on
   * the bottom edge.
   */
  scrollable?: boolean;
  /** Shows the "Need help signing in?" link under the content. */
  showHelp?: boolean;
  /** Puts the wordmark in the top-left corner, as on the pinned login page. */
  cornerLogo?: boolean;
}) {
  const { slide, measure, onFrameLayout } = useKeyboardSlide(focusTargetRef);
  const content = typeof children === "function" ? children(measure) : children;
  // Pinned pages sit in a plain view, not a ScrollView: Android clips a ScrollView at its edge, which cut
  // off what runs on below the login card (its fill down to the keyboard) and left a gap above the keyboard.
  const page = (
    <View
      className={cn("w-full max-w-[520px] px-5 pt-7 sm:px-8 sm:pt-10", scrollable && "pb-4")}
      style={{ flexGrow: 1, flexShrink: 0 }}
      onLayout={measure}
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
            // Lowered while there is room above the content.
            scrollable && cornerLogo && "relative top-10",
          )}
        >
          <RokloWordmark width={scrollable ? 180 : 207} height={scrollable ? 33 : 38} />
        </View>
      )}
      <View
        className={cn(
          "grow justify-center py-8",
          !scrollable && "py-4",
          scrollable && cornerLogo && "py-6",
        )}
      >
        {hero && !scrollable && (
          // The hero takes all the space above the card. `flex-1` is
          // `flex: 1 1 0%`; in this auto-height column the percentage
          // basis resolves to the content size, so a numeric zero
          // basis is used.
          <View
            style={{
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              minHeight: 0,
            }}
          >
            {hero}
          </View>
        )}
        {scrollable && !cornerLogo && (
          <View className="mb-10 items-center">
            <RokloWordmark width={207} height={38} />
          </View>
        )}
        {hero && scrollable && <View className="-mt-2 mb-8">{hero}</View>}
        {scrollable && content}
      </View>
      {!scrollable && <View>{content}</View>}
      {showHelp && (
        <Link href={`${env.webUrl}/help`} asChild>
          <CustomButton
            variant="link"
            size="sm"
            className="mt-6 self-center"
            leadingIcon={<CustomIcon as={CircleHelp} size={15} className="text-ink-700" />}
          >
            <CustomText className="font-sans text-[13px] text-ink-700 no-underline">
              Need help signing in?
            </CustomText>
          </CustomButton>
        </Link>
      )}
    </View>
  );

  return (
    <View className={cn("flex-1", tinted ? "bg-brand-100" : "bg-ink-50")}>
      <AuthBackdrop />
      {/* Pinned children reach the bottom edge and pad the inset themselves. */}
      <SafeAreaView className="flex-1" edges={scrollable ? undefined : ["top", "left", "right"]}>
        <View collapsable={false} style={{ flex: 1 }} onLayout={onFrameLayout}>
          <Animated.View style={[{ flex: 1 }, slide]}>
            {scrollable ? (
              <ScrollView
                className="flex-1"
                // Scrolled at rest, the part to keep visible has moved.
                onScrollEndDrag={measure}
                onMomentumScrollEnd={measure}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ flexGrow: 1 }}
                contentContainerClassName="items-center"
              >
                {page}
              </ScrollView>
            ) : (
              // A tap outside the field closes the keyboard, as the ScrollView did.
              <Pressable
                accessible={false}
                onPress={Keyboard.dismiss}
                className="flex-1 items-center"
              >
                {page}
              </Pressable>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
