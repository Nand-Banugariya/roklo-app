import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { FlatList, Keyboard, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CountryFlag } from "@/components/shadcn-custom/country-flag";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { filterCountries, getCountry } from "@/lib/auth/countries";
import { cn } from "@/lib/utils";

export interface CustomCountryPickerProps {
  value: string;
  onChange: (code: string) => void;
  variant?: "default" | "auth";
  disabled?: boolean;
}

export { CountryFlag } from "@/components/shadcn-custom/country-flag";

export function CustomCountryPicker({
  value,
  onChange,
  variant = "default",
  disabled,
}: CustomCountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchHeight, setSearchHeight] = useState(56);
  const triggerRef = useRef<ComponentRef<typeof PopoverTrigger>>(null);
  const viewport = useKeyboardViewport(open);
  const country = getCountry(value);
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }
  useEffect(() => {
    if (!open) return;
    // Dismissing the phone keyboard can move the trigger; follow its new position.
    const timer = setTimeout(() => triggerRef.current?.open(), 250);
    return () => clearTimeout(timer);
  }, [
    open,
    viewport.windowHeight,
    viewport.width,
    viewport.top,
    viewport.bottom,
  ]);
  return (
    <Popover onOpenChange={changeOpen} className="h-full">
      <PopoverTrigger
        ref={triggerRef}
        disabled={disabled}
        onPress={() => Keyboard.dismiss()}
        asChild
      >
        <Pressable
          disabled={disabled}
          accessibilityLabel={`Country code, ${country.name} ${country.dial}`}
          className={cn(
            "h-full flex-row items-center gap-2 rounded-l-lg border-r border-ink-200 px-3 active:bg-ink-50",
            disabled && "opacity-50",
          )}
        >
          <CountryFlag code={country.code} />
          <Text
            className={cn(
              "font-sans-medium text-sm",
              variant === "auth" && "text-[15px]",
            )}
          >
            {country.dial}
          </Text>
          <Icon as={ChevronDown} size={14} className="text-ink-400" />
        </Pressable>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        avoidCollisions
        insets={{
          top: viewport.top,
          bottom: viewport.bottom,
          left: 20,
          right: 20,
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        accessibilityLabel="Select country"
        className="overflow-hidden rounded-lg p-0"
        style={{
          width: Math.min(320, viewport.width - 40),
          maxHeight: viewport.maxHeight,
        }}
      >
        <View
          className="border-b border-ink-200 p-2"
          onLayout={(event) => setSearchHeight(event.nativeEvent.layout.height)}
        >
          <CustomInput
            value={query}
            onChangeText={setQuery}
            size="lg"
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="Search country or code"
            accessibilityLabel="Search countries"
          />
        </View>
        <FlatList
          data={filterCountries(query)}
          keyExtractor={(item) => item.code}
          style={{
            maxHeight: Math.max(
              0,
              Math.min(260, viewport.maxHeight - searchHeight - 2),
            ),
          }}
          contentContainerStyle={{ padding: 4 }}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={
            <Text className="py-4 text-sm text-ink-600">No country found</Text>
          }
          renderItem={({ item }) => (
            <PopoverClose asChild>
              <Pressable
                role="radio"
                accessibilityState={{ checked: item.code === value }}
                onPress={() => {
                  onChange(item.code);
                  Keyboard.dismiss();
                }}
                className={cn(
                  "min-h-11 flex-row items-center gap-2.5 rounded-md px-2 active:bg-ink-100",
                  item.code === value && "bg-ink-100",
                )}
              >
                <CountryFlag code={item.code} />
                <Text className="flex-1 text-sm">{item.name}</Text>
                <Text className="text-[13px] text-ink-600">{item.dial}</Text>
                {item.code === value && (
                  <Icon as={Check} size={16} className="text-primary" />
                )}
              </Pressable>
            </PopoverClose>
          )}
        />
      </PopoverContent>
    </Popover>
  );
}
