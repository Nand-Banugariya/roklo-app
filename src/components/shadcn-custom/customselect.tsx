import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { FlatList, Keyboard, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { cn } from "@/lib/utils";
import { CustomIcon } from "./customicon";
import { CustomInput } from "./custominput";
import { CustomText } from "./customtext";

/** Searchable dropdown constrained to the visible area above the keyboard. */
export function CustomSelect({
  value,
  options,
  onValueChange,
  placeholder,
  accessibilityLabel,
  nativeID,
  searchPlaceholder = "Search industries",
  emptyMessage = "No matching industry",
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  nativeID?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [width, setWidth] = useState(300);
  const [searchHeight, setSearchHeight] = useState(60);
  const trigger = useRef<ComponentRef<typeof PopoverTrigger>>(null);
  const viewport = useKeyboardViewport(open);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => trigger.current?.open(), 250);
    return () => clearTimeout(timer);
  }, [
    open,
    viewport.windowHeight,
    viewport.width,
    viewport.top,
    viewport.bottom,
  ]);
  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger ref={trigger} asChild onPress={() => Keyboard.dismiss()}>
        <Pressable
          nativeID={nativeID}
          role="combobox"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: selected?.label ?? placeholder }}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className="min-h-12 flex-row items-center gap-3 rounded-lg border border-input bg-card px-3.5"
        >
          <CustomText
            className={cn(
              "flex-1 text-base",
              !selected && "text-muted-foreground",
            )}
          >
            {selected?.label ?? placeholder}
          </CustomText>
          <CustomIcon as={ChevronDown} size={17} className="text-ink-500" />
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
        accessibilityLabel={accessibilityLabel}
        className="overflow-hidden rounded-xl p-0"
        style={{
          width: Math.min(width, viewport.width - 40),
          maxHeight: viewport.maxHeight,
        }}
      >
        <View
          className="border-b border-border p-2"
          onLayout={(event) => setSearchHeight(event.nativeEvent.layout.height)}
        >
          <CustomInput
            size="xl"
            placeholder={searchPlaceholder}
            accessibilityLabel={searchPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          style={{
            maxHeight: Math.max(
              0,
              Math.min(280, viewport.maxHeight - searchHeight - 2),
            ),
          }}
          contentContainerStyle={{ padding: 4 }}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={
            <CustomText className="p-4 text-sm text-ink-600">
              {emptyMessage}
            </CustomText>
          }
          renderItem={({ item }) => (
            <PopoverClose asChild>
              <Pressable
                role="radio"
                accessibilityState={{ checked: item.value === value }}
                aria-checked={item.value === value}
                onPress={() => {
                  onValueChange(item.value);
                  Keyboard.dismiss();
                }}
                className={cn(
                  "min-h-12 flex-row items-center gap-3 rounded-lg px-3 py-2 active:bg-ink-100",
                  item.value === value && "bg-brand-50",
                )}
              >
                <CustomText className="flex-1 text-sm">{item.label}</CustomText>
                {item.value === value && (
                  <CustomIcon as={Check} size={17} className="text-primary" />
                )}
              </Pressable>
            </PopoverClose>
          )}
        />
      </PopoverContent>
    </Popover>
  );
}
