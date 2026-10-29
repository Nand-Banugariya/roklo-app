import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RokloWordmark } from "@/components/brand/roklo-wordmark";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useKeyboardScroll } from "@/features/auth/hooks/use-keyboard-scroll";
import { cn } from "@/lib/utils";

const FocusContext = createContext<(target: RefObject<View | null>) => void>(() => undefined);
export const useSetupFocus = () => useContext(FocusContext);

export function SetupLayout({
  children,
  footer,
  steps,
  current = 0,
  onSignOut,
}: {
  children: ReactNode;
  footer?: ReactNode;
  steps?: readonly string[];
  current?: number;
  onSignOut?: () => void;
}) {
  const activeTarget = useRef<RefObject<View | null> | null>(null);
  // Autofocus can run before an ancestor's ref is attached. Resolve the ref at
  // measurement time so the newly mounted OTP section can still be revealed.
  const target = useMemo(
    () => ({
      get current() {
        return activeTarget.current?.current ?? null;
      },
    }),
    [],
  );
  const { scrollRef, viewportRef, keyboardInset, keyboardVisible, scheduleReveal, onScroll } =
    useKeyboardScroll(target);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [current, scrollRef]);
  return (
    <SafeAreaView className="flex-1 bg-ink-50">
      <View
        className={cn(
          "items-center border-b border-ink-200 px-5 py-5 sm:px-8",
          keyboardVisible && "py-2",
        )}
      >
        <View className="w-full max-w-[520px] flex-row items-center justify-between gap-4">
          <RokloWordmark width={130} height={25} />
          {onSignOut && (
            <CustomButton variant="ghost" size="sm" className="h-11 px-0" onPress={onSignOut}>
              Sign out
            </CustomButton>
          )}
        </View>
        {steps && !keyboardVisible && (
          <View
            className="mt-5 w-full max-w-[520px] gap-2.5"
            accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
          >
            <View className="flex-row gap-2" accessibilityElementsHidden>
              {steps.map((label, index) => (
                <View
                  key={label}
                  className={cn(
                    "h-1.5 flex-1 rounded-full bg-ink-200",
                    index <= current && "bg-brand-600",
                  )}
                />
              ))}
            </View>
            <View className="flex-row justify-between gap-2">
              <CustomText className="text-xs text-ink-600">
                Step {current + 1} of {steps.length}
              </CustomText>
              <CustomText className="font-sans-medium text-xs text-brand-700">
                {steps[current]}
              </CustomText>
            </View>
          </View>
        )}
      </View>
      <View ref={viewportRef} collapsable={false} style={{ flex: 1 }} onLayout={scheduleReveal}>
        <View style={{ flex: 1, paddingBottom: keyboardInset }}>
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            contentContainerClassName="items-center"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={onScroll}
            scrollEventThrottle={16}
            onLayout={scheduleReveal}
            onContentSizeChange={scheduleReveal}
          >
            <FocusContext.Provider
              value={(view) => {
                activeTarget.current = view;
                scheduleReveal();
              }}
            >
              <View
                className="w-full max-w-[520px] gap-7 px-5 pb-8 pt-7 sm:px-8 sm:pt-10"
                style={{ flexGrow: 1 }}
              >
                {children}
                {footer && <View className="grow justify-end pt-4">{footer}</View>}
              </View>
            </FocusContext.Provider>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
