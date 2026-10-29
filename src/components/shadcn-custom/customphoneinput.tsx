import { useState } from "react";
import { View } from "react-native";

import { CustomCountryPicker } from "@/components/shadcn-custom/customcountrypicker";
import { CustomInput, type CustomInputProps } from "@/components/shadcn-custom/custominput";
import { formatPhone } from "@/lib/auth/phone";
import { cn } from "@/lib/utils";

export interface CustomPhoneInputProps extends Omit<
  CustomInputProps,
  "value" | "onChangeText" | "size" | "keyboardType"
> {
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onValueChange: (raw: string) => void;
  variant?: "default" | "auth";
  disabled?: boolean;
}

export function CustomPhoneInput({
  country,
  onCountryChange,
  value,
  onValueChange,
  variant = "default",
  invalid,
  disabled,
  className,
  onFocus,
  onBlur,
  ...props
}: CustomPhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const formatted = formatPhone(value, country);
  return (
    <View
      className={cn(
        "h-9 flex-row items-center rounded-md border border-input bg-card",
        variant === "auth" && "h-12 rounded-lg",
        focused && "border-ring",
        invalid && "border-error-fg bg-error-bg-2",
        disabled && "opacity-50",
        className,
      )}
    >
      <CustomCountryPicker
        value={country}
        onChange={onCountryChange}
        variant={variant}
        disabled={disabled}
      />
      <CustomInput
        {...props}
        value={formatted}
        onChangeText={onValueChange}
        editable={!disabled}
        keyboardType="phone-pad"
        autoComplete="tel-national"
        textContentType="telephoneNumber"
        size={variant === "auth" ? "xl" : "md"}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 tracking-[0.02em]"
      />
    </View>
  );
}
