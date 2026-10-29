import { X } from "lucide-react-native";
import { useRef, type ReactNode } from "react";
import { Modal, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardScroll } from "@/features/auth/hooks/use-keyboard-scroll";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { cn } from "@/lib/utils";
import { CustomIcon } from "./customicon";
import { CustomText } from "./customtext";

/** Shared mobile sheet with OS back/Escape handling and a scrollable safe area. */
export function CustomSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const target = useRef<View>(null);
  const {
    viewportRef,
    scrollRef,
    scheduleReveal,
    onScroll,
    keyboardInset: nativeKeyboardInset,
  } = useKeyboardScroll(target);
  const viewport = useKeyboardViewport(open);
  const safeArea = useSafeAreaInsets();
  const keyboardInset =
    Platform.OS === "web"
      ? Math.max(0, viewport.bottom - 12 - safeArea.bottom)
      : nativeKeyboardInset;
  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View ref={viewportRef} collapsable={false} className="flex-1" onLayout={scheduleReveal}>
        <View
          style={{ paddingBottom: keyboardInset }}
          className={cn("flex-1 bg-overlay", wide ? "items-end justify-start" : "justify-end")}
        >
          <Pressable
            className="absolute inset-0"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
          />
          <SafeAreaView
            edges={wide ? ["top", "right", "bottom"] : ["bottom", "left", "right"]}
            style={{
              width: wide ? 400 : "100%",
              maxHeight: wide ? height : Math.min(height * 0.92, 800),
              flexShrink: 1,
            }}
            className={cn(
              "border-border bg-card",
              wide ? "h-full border-l" : "rounded-t-3xl border-t",
            )}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel={title}
          >
            {!wide && (
              <View className="items-center pt-3">
                <View className="h-1 w-10 rounded-full bg-ink-200" />
              </View>
            )}
            <View className="flex-row items-center gap-4 border-b border-ink-200 px-5 pb-4 pt-5">
              <View className="flex-1 gap-1">
                <CustomText
                  role="heading"
                  className="font-sans-semibold text-lg text-foreground dark:text-white"
                >
                  {title}
                </CustomText>
                {description && (
                  <CustomText className="text-[13px] leading-5 text-ink-600 dark:text-white">
                    {description}
                  </CustomText>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close ${title}`}
                onPress={onClose}
                className="h-11 w-11 items-center justify-center rounded-full bg-ink-75 active:bg-ink-100"
              >
                <CustomIcon as={X} size={20} className="text-ink-700" />
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              onLayout={scheduleReveal}
              onContentSizeChange={scheduleReveal}
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
              style={{ flexShrink: 1 }}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
