import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { CustomText } from "@/components/shadcn-custom/customtext";
import { cn } from "@/lib/utils";

import { AuthArt, type AuthArtName } from "./auth-art";

const SLIDES: {
  key: AuthArtName;
  title: string;
  description: string;
}[] = [
  {
    key: "welcome",
    title: "Welcome to Roklo!",
    description:
      "Talk to all your customers on WhatsApp, together with your team.",
  },
  {
    key: "inbox",
    title: "Inbox",
    description: "Every chat for your number in one shared inbox.",
  },
  {
    key: "broadcast",
    title: "Broadcast",
    description: "Send updates that feel personal to all your customers.",
  },
  {
    key: "note",
    title: "Private note",
    description: "Leave notes on a chat that only your team can see.",
  },
];
const ADVANCE_MS = 4500;
// Fallback until the carousel is measured; smaller on short phones.
const fallbackArtHeight = (windowHeight: number) =>
  windowHeight < 700 ? 148 : windowHeight < 760 ? 168 : 232;
// Title, two description lines, dots and gaps under the art.
const TEXT_BLOCK = 150;
const MIN_ART = 120;
const MAX_ART = 380;
// The art grows to fill the space above the card, so no gap is left behind.
const artHeight = (
  available: number,
  width: number,
  windowHeight: number,
  compact: boolean,
  compactHeight: number,
) =>
  compact && compactHeight > 0
    ? // Keyboard open: the whole art, scaled to the strip above the card, so the
      // card never covers part of it.
      Math.min(MAX_ART, compactHeight)
    : compact && width > 0
      ? Math.min(MAX_ART, Math.max(MIN_ART, width * 0.75))
      : available > 0
        ? Math.min(
            MAX_ART,
            // The art is 4:3, so it never needs to be taller than the width allows.
            Math.max(MIN_ART, width * 0.75),
            Math.max(MIN_ART, available - TEXT_BLOCK),
          )
        : fallbackArtHeight(windowHeight);

export function AuthCarousel({ compact = false }: { compact?: boolean }) {
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [available, setAvailable] = useState(0);
  const [compactHeight, setCompactHeight] = useState(0);
  const [dragging, setDragging] = useState(false);

  const select = useCallback((next: number) => {
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
  }, []);
  const goTo = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({
        x: next * width,
        animated: !reducedMotion,
      });
      select(next);
    },
    [reducedMotion, select, width],
  );

  // Restart the timer after every slide change so a swipe gets a full pause.
  // Stops while another auth screen is on top or the user prefers less motion.
  useFocusEffect(
    useCallback(() => {
      if (reducedMotion || dragging || !width) return;
      const timer = setTimeout(
        () => goTo((index + 1) % SLIDES.length),
        ADVANCE_MS,
      );
      return () => clearTimeout(timer);
    }, [dragging, goTo, index, reducedMotion, width]),
  );

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    select(Math.min(SLIDES.length - 1, Math.max(0, next)));
  }

  return (
    <View
      className={cn("flex-1 gap-4", "justify-center")}
      // Size from the space given, not from the art inside (web feedback loop).
      style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 }}
      onLayout={(event) => {
        const { width: next, height } = event.nativeEvent.layout;
        setWidth(next);
        // Keep the full-size measurement while the keyboard squeezes the box.
        if (compact) setCompactHeight(Math.floor(height));
        else setAvailable(height);
        // Keep the current slide in view after a rotation or resize.
        scrollRef.current?.scrollTo({
          x: indexRef.current * next,
          animated: false,
        });
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        // ScrollView grows by default; keep it as tall as the slides so the
        // dots stay right under the text.
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.key}
            style={{ width }}
            className="items-center gap-2"
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                height: artHeight(
                  available,
                  width,
                  windowHeight,
                  compact,
                  compactHeight,
                ),
              }}
              className="w-full"
            >
              <AuthArt name={slide.key} />
            </View>
            {!compact && (
              <>
                <CustomText className="mt-2 px-4 text-center font-sans-semibold text-lg leading-6 text-ink-900">
                  {slide.title}
                </CustomText>
                <CustomText className="px-6 text-center text-sm leading-5 text-ink-700">
                  {slide.description}
                </CustomText>
              </>
            )}
          </View>
        ))}
      </ScrollView>
      {!compact && (
        <View className="flex-row items-center justify-center gap-1.5">
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.key}
              hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Show slide ${i + 1} of ${SLIDES.length}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => goTo(i)}
            >
              <View
                className={cn(
                  "h-1.5 w-1.5 rounded-full bg-ink-300",
                  i === index && "w-5 bg-brand-600",
                )}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
