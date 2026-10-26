import { useCallback, useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { cn } from "@/lib/utils";
import {
  SETTINGS_GROUPS,
  type SettingsSectionId,
} from "../config/settings-navigation";

export function SettingsNavigation({
  active,
  onChange,
  wide,
  canManage,
  workspaceName,
}: {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  wide: boolean;
  canManage: boolean;
  workspaceName?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const activeRef = useRef<View>(null);
  const offset = useRef(0);
  const revealActive = useCallback(() => {
    const scroll = scrollRef.current;
    const viewport = viewportRef.current;
    const item = activeRef.current;
    if (wide || !scroll || !viewport || !item) return;
    viewport.measureInWindow((left, _top, width) => {
      item.measureInWindow((itemLeft, _itemTop, itemWidth) => {
        if (
          width <= 0 ||
          itemWidth <= 0 ||
          (itemLeft >= left && itemLeft + itemWidth <= left + width)
        )
          return;
        scroll.scrollTo({
          x: Math.max(
            0,
            offset.current + itemLeft - left - (width - itemWidth) / 2,
          ),
          animated: true,
        });
      });
    });
  }, [wide]);
  useEffect(() => {
    const frame = requestAnimationFrame(revealActive);
    return () => cancelAnimationFrame(frame);
  }, [active, revealActive]);
  return (
    <View
      ref={viewportRef}
      className={cn(
        "border-ink-200 bg-card",
        wide ? "w-[208px] border-r" : "border-b",
      )}
    >
      <ScrollView
        ref={scrollRef}
        onLayout={revealActive}
        onContentSizeChange={revealActive}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        horizontal={!wide}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: 12, gap: wide ? 20 : 4 }}
        accessibilityLabel="Settings sections"
      >
        {SETTINGS_GROUPS.map((group) => (
          <View key={group.label} className={wide ? "gap-1" : "flex-row gap-1"}>
            {wide && (
              <CustomText
                numberOfLines={1}
                className="mb-1 px-3 font-sans-semibold text-[10px] uppercase tracking-[1px] text-ink-500 dark:text-white"
              >
                {group.label}
                {group.label === "Workspace" && workspaceName
                  ? ` · ${workspaceName}`
                  : ""}
              </CustomText>
            )}
            {group.items
              .filter(
                (item) =>
                  canManage || group.label === "Account" || item.id === "team",
              )
              .map((item) => {
                const selected = item.id === active;
                return (
                  <Pressable
                    ref={selected ? activeRef : undefined}
                    key={item.id}
                    role="button"
                    accessibilityLabel={`${item.label} settings`}
                    accessibilityState={{ selected }}
                    aria-current={selected ? "page" : undefined}
                    onPress={() => onChange(item.id)}
                    className={cn(
                      "min-h-11 flex-row items-center gap-2.5 rounded-lg px-3 py-2.5 active:bg-ink-100",
                      selected && "bg-brand-50",
                    )}
                  >
                    <CustomIcon
                      as={item.icon}
                      size={17}
                      className={selected ? "text-brand-700" : "text-ink-600"}
                    />
                    <CustomText
                      className={cn(
                        "text-[13px] text-ink-700 dark:text-white",
                        selected && "font-sans-semibold text-brand-800",
                      )}
                    >
                      {item.label}
                    </CustomText>
                  </Pressable>
                );
              })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
