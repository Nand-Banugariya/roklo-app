import { useState, type ComponentProps } from "react";
import { Platform, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export interface CustomOTPInputProps
  extends Pick<
    ComponentProps<typeof TextInput>,
    | "nativeID"
    | "accessibilityLabel"
    | "accessibilityHint"
    | "autoFocus"
    | "onFocus"
  > {
  length?: number;
  value: string;
  onValueChange: (value: string) => void;
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  channel?: "sms" | "email";
}

// One native input preserves paste, backspace, accessibility, and OS OTP autofill.
export function CustomOTPInput({
  length = 6,
  value,
  onValueChange,
  onComplete,
  invalid,
  disabled,
  className,
  channel = "sms",
  onFocus,
  ...props
}: CustomOTPInputProps) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);
  return (
    <View
      className={cn("relative w-full", disabled && "opacity-50", className)}
    >
      <View
        className="flex-row gap-2.5"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length }, (_, index) => (
          <View
            key={index}
            className={cn(
              "h-[60px] min-w-0 flex-1 items-center justify-center rounded-lg border border-input bg-card",
              focused && index === activeIndex && "border-ring",
              invalid && "border-error-fg bg-error-bg-2",
            )}
          >
            <Text className="font-sans-semibold text-2xl">
              {value[index] || (focused && index === activeIndex ? "│" : "")}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        {...props}
        accessibilityLabel={
          props.accessibilityLabel ?? `${length}-digit verification code`
        }
        value={value}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={
          Platform.OS === "android" && channel === "sms"
            ? "sms-otp"
            : "one-time-code"
        }
        autoCorrect={false}
        caretHidden
        selectionColor="transparent"
        underlineColorAndroid="transparent"
        accessibilityState={{ disabled: !!disabled }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full bg-transparent text-transparent"
        // Transparent text color is not honored by TextInput on every platform,
        // so hide the native field visually while keeping it focusable.
        style={{ opacity: 0 }}
        onChangeText={(raw) => {
          const next = raw.replace(/\D/g, "").slice(0, length);
          onValueChange(next);
          if (next.length === length && next !== value) onComplete?.(next);
        }}
      />
    </View>
  );
}
