import { router, useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import Animated from "react-native-reanimated";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { goBack, ScreenHeader } from "@/features/navigation/components/screen-header";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import { InboxSkeleton, InboxState } from "../components/inbox-state";
import { NumberActionMenu, type NumberPanel } from "../components/number-actions";
import { NumberCard } from "../components/number-card";
import { useSmoothMotion } from "../hooks/use-smooth-motion";
import { useMessaging } from "../providers/messaging-provider";
import { isConnected } from "../types";

/** Where a number's "…" menu opens: its card's top within the list, plus the button's bottom within the card. */
type MenuAnchor = { card: number; button: number };

export function NumbersScreen() {
  const { numbers, activeNumber, loading, error, refreshNumbers, selectNumber } = useMessaging();
  useFocusEffect(useCallback(() => { if (!loading) void refreshNumbers(); }, [refreshNumbers, loading]));
  // Active number first, the rest in their usual order.
  const ordered = activeNumber ? [activeNumber, ...numbers.filter((number) => number.id !== activeNumber.id)] : numbers;
  const live = numbers.filter(isConnected).length;
  // The number whose "…" menu is open (panel null), or whose picked option's form is showing in its card.
  const [open, setOpen] = useState<{ id: string; panel: NumberPanel | null } | null>(null);
  const [anchors, setAnchors] = useState<Record<string, MenuAnchor>>({});
  const measure = (id: string, part: keyof MenuAnchor, value: number) => setAnchors((current) => current[id]?.[part] === value ? current
    : { ...current, [id]: { ...(current[id] ?? { card: 0, button: 0 }), [part]: value } });
  const menuNumber = open && !open.panel ? numbers.find((number) => number.id === open.id) : undefined;
  const menuAnchor = menuNumber && anchors[menuNumber.id];
  const motion = useSmoothMotion();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const role = useAppSelector(selectActiveWorkspace)?.role;
  // Whoever added a number, and owners/admins, may change who sees it (the API's rule).
  const isAdmin = role === "OWNER" || role === "ADMIN";
  return <View className="flex-1 bg-background">
    <ScreenHeader title="WhatsApp numbers" subtitle={numbers.length ? `${live} of ${numbers.length} live` : undefined} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow pb-10 pt-2" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refreshNumbers()} />}>
      {error && <View className="gap-1 px-5 py-3"><CustomAlert tone="error">{error}</CustomAlert><CustomButton variant="link" onPress={() => void refreshNumbers()}>Try again</CustomButton></View>}
      {loading && !numbers.length ? <InboxSkeleton /> : !numbers.length && !error
        ? <InboxState icon={Plus} title="Your business, connected" description="Link your WhatsApp number with a phone-number code. Each number gets its own inbox."
          action="Connect a number" actionIcon={Plus} onAction={() => router.push("/connect-number")} />
        // flex-1 so the area the menu is laid over takes touches all the way down on Android.
        : <View className="flex-1">
          <View className="gap-3 pt-3">
            <CustomText className="px-5 font-sans-semibold text-[11px] tracking-wider text-muted-foreground">YOUR NUMBERS</CustomText>
            {ordered.map((number) => <Animated.View key={number.id} layout={motion.layout} onLayout={(event) => measure(number.id, "card", event.nativeEvent.layout.y)}>
              <NumberCard number={number} active={number.id === activeNumber?.id}
                menuOpen={open?.id === number.id && !open.panel} panel={open?.id === number.id ? open.panel : null} isOwner={!userId || number.userId === userId}
                onSelect={() => { if (number.id !== activeNumber?.id) selectNumber(number.id); goBack(); }}
                onToggleMenu={() => setOpen((current) => current?.id === number.id && !current.panel ? null : { id: number.id, panel: null })}
                onMenuButtonLayout={(event) => { const { y, height } = event.nativeEvent.layout; measure(number.id, "button", y + height); }}
                onClosePanel={() => setOpen(null)} />
            </Animated.View>)}
          </View>
          {/* Slides down smoothly when a card above it grows. */}
          <Animated.View layout={motion.layout}>
          <View className="mx-4 mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/5">
            <MotionPressable role="button" accessibilityLabel="Connect another number" onPress={() => router.push("/connect-number")}
              className="min-h-14 flex-row items-center gap-3 px-4 py-2.5 active:bg-accent">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
                <CustomIcon as={Plus} size={18} className="text-primary" />
              </View>
              <CustomText className="flex-1 font-sans-medium text-[15px] text-primary">Connect another number</CustomText>
            </MotionPressable>
          </View>
          </Animated.View>
          {menuNumber && <>
            {/* Tapping anywhere outside the menu closes it, without also pressing what's underneath. */}
            <Pressable accessibilityLabel="Close options" onPress={() => setOpen(null)} className="absolute inset-0 z-10" />
            <NumberActionMenu top={(menuAnchor ? menuAnchor.card + menuAnchor.button : 0) + 2}
              canChangeVisibility={!userId || menuNumber.userId === userId || isAdmin}
              onRename={() => setOpen({ id: menuNumber.id, panel: "rename" })}
              onVisibility={() => setOpen({ id: menuNumber.id, panel: "visibility" })}
              onRemove={() => setOpen({ id: menuNumber.id, panel: "remove" })} />
          </>}
        </View>}
    </ScrollView>
  </View>;
}
