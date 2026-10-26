import { router } from "expo-router";
import { CircleCheck, Ellipsis, Globe, Lock, MessageCircle, Smartphone, Users, type LucideIcon } from "lucide-react-native";
import { View, type LayoutChangeEvent } from "react-native";
import Animated from "react-native-reanimated";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { connectionState, numberName, numberPhone, type ConnectionState, type WhatsAppNumber } from "../types";
import { useSmoothMotion } from "../hooks/use-smooth-motion";
import { NumberActionPanel, type NumberPanel } from "./number-actions";

const STATUS: Record<ConnectionState, { label: string; pill: string; dot: string; text: string; tile: string; icon: string }> = {
  connected: { label: "Connected", pill: "bg-success-bg", dot: "bg-primary", text: "text-success-fg", tile: "bg-success-bg", icon: "text-primary" },
  connecting: { label: "Connecting…", pill: "bg-accent", dot: "bg-warning-solid", text: "text-muted-foreground", tile: "bg-accent", icon: "text-muted-foreground" },
  disconnected: { label: "Disconnected", pill: "bg-error-bg-2", dot: "bg-error-solid", text: "text-error-fg", tile: "bg-error-bg-2", icon: "text-error-fg" },
  unlinked: { label: "Not linked", pill: "bg-accent", dot: "bg-muted-foreground", text: "text-muted-foreground", tile: "bg-accent", icon: "text-muted-foreground" },
};
const count = new Intl.NumberFormat("en-IN");

/** Who sees the number's chats, in a few words: "Everyone", "3 teams and people", "Only me". */
function visibilityOf(number: WhatsAppNumber, isOwner: boolean): { icon: LucideIcon; label: string } {
  if (number.visibility === "TEAM") {
    const shared = number.accessGrants?.length ?? 0;
    return { icon: Users, label: shared ? `${shared} ${shared === 1 ? "team or person" : "teams and people"}` : "Teams and people" };
  }
  if (number.visibility === "ME_ONLY") return { icon: Lock, label: isOwner ? "Only me" : "Only its owner" };
  return { icon: Globe, label: "Everyone" };
}

/**
 * One WhatsApp number as a card: who it is, its status / chats / visibility as chips, and today's
 * sends against the daily limit in a footer (or what to do when it's offline). Its options open from
 * the "…" button (the menu is drawn by the screen); the picked option's form opens inside the card.
 */
export function NumberCard({ number, active, menuOpen, panel, isOwner, onSelect, onToggleMenu, onMenuButtonLayout, onClosePanel }: {
  number: WhatsAppNumber; active: boolean; menuOpen: boolean; panel: NumberPanel | null; isOwner: boolean;
  onSelect: () => void; onToggleMenu: () => void; onMenuButtonLayout: (event: LayoutChangeEvent) => void; onClosePanel: () => void;
}) {
  const state = connectionState(number);
  const status = STATUS[state];
  const name = numberName(number);
  const phone = number.phoneNumber ? numberPhone(number) : null;
  const chats = number.chatCount != null ? `${count.format(number.chatCount)} ${number.chatCount === 1 ? "chat" : "chats"}` : null;
  const visibility = visibilityOf(number, isOwner);
  const offline = state === "disconnected" || state === "unlinked";
  const motion = useSmoothMotion();

  // The card glides to its new height as a form opens or closes inside it.
  return <Animated.View layout={motion.layout}>
  <View className={cn("mx-4 overflow-hidden rounded-2xl border bg-card shadow-sm shadow-black/5", active ? "border-brand-300" : "border-border")}>
    <MotionPressable role="button" accessibilityState={{ selected: active }}
      accessibilityLabel={`${name}${phone && phone !== name ? `, ${phone}` : ""}, ${status.label}${active ? ", working from this number" : ". Switch to this number"}`}
      onPress={onSelect} className="gap-3 p-4 active:bg-accent">
      <View className="flex-row items-center gap-3 pr-8">
        <View className={cn("h-11 w-11 items-center justify-center rounded-xl", status.tile)}>
          <CustomIcon as={Smartphone} size={20} className={status.icon} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <CustomText numberOfLines={1} className="shrink font-sans-semibold text-base text-foreground">{name}</CustomText>
            {active && <CustomIcon as={CircleCheck} size={16} className="text-primary" />}
          </View>
          {phone && phone !== name && <CustomText numberOfLines={1} className="text-[13px] text-muted-foreground">{phone}</CustomText>}
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        <View className={cn("h-6 flex-row items-center gap-1.5 rounded-full px-2.5", status.pill)}>
          <View className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          <CustomText className={cn("font-sans-semibold text-[11px]", status.text)}>{status.label}</CustomText>
        </View>
        {chats && state !== "unlinked" && <Chip icon={MessageCircle} label={chats} />}
        <Chip icon={visibility.icon} label={visibility.label} accessibilityLabel={`Visible to ${visibility.label}`} />
      </View>
    </MotionPressable>

    {/* Sits over the card's top-right corner, outside the card's own press target. */}
    <MotionPressable role="button" accessibilityLabel={`${name} options`} accessibilityState={{ expanded: menuOpen }} onPress={onToggleMenu} onLayout={onMenuButtonLayout}
      className={cn("absolute right-2 top-3 h-10 w-10 items-center justify-center rounded-full active:bg-accent", menuOpen && "bg-accent")}>
      <CustomIcon as={Ellipsis} size={18} className="text-muted-foreground" />
    </MotionPressable>

    <View className="border-t border-border bg-background px-4 py-3">
      {offline ? <View className="flex-row items-center gap-3">
        <CustomText className="flex-1 text-xs leading-4 text-muted-foreground">
          {state === "unlinked" ? "Link a phone to start receiving chats." : "Not syncing. Reconnect to keep chats coming in."}
        </CustomText>
        <MotionPressable role="button" accessibilityLabel={`${state === "unlinked" ? "Link" : "Reconnect"} ${name}`} hitSlop={{ top: 6, bottom: 6 }}
          onPress={() => router.push({ pathname: "/connect-number", params: { sessionId: number.id } })}
          className="h-8 justify-center rounded-full bg-primary px-3.5 active:opacity-80">
          <CustomText className="font-sans-semibold text-xs text-primary-foreground">{state === "unlinked" ? "Link phone" : "Reconnect"}</CustomText>
        </MotionPressable>
      </View> : <Usage number={number} name={name} />}
    </View>

    {panel && <Animated.View key={panel} {...motion.panel}>
      <View className="border-t border-border p-4">
        <NumberActionPanel panel={panel} number={number} isOwner={isOwner} onDone={onClosePanel} />
      </View>
    </Animated.View>}
  </View>
  </Animated.View>;
}

function Chip({ icon, label, accessibilityLabel }: { icon: LucideIcon; label: string; accessibilityLabel?: string }) {
  return <View accessibilityLabel={accessibilityLabel} className="h-6 max-w-full flex-row items-center gap-1 rounded-full border border-border px-2.5">
    <CustomIcon as={icon} size={12} className="text-muted-foreground" />
    <CustomText numberOfLines={1} className="shrink font-sans-medium text-[11px] text-muted-foreground">{label}</CustomText>
  </View>;
}

/** Today's sends against the daily cap with a meter; "Paused" while sending from the number is off. */
function Usage({ number, name }: { number: WhatsAppNumber; name: string }) {
  const paused = !number.isActive || number.dailyCap == null;
  const cap = Math.max(number.dailyCap ?? 0, 1);
  const sent = Math.min(number.dailySentCount ?? 0, cap);
  const full = sent >= cap;
  const label = paused ? "Paused" : `${count.format(number.dailySentCount ?? 0)} / ${count.format(number.dailyCap ?? 0)}`;
  return <View className="gap-2" accessibilityLabel={`${name} messages sent today: ${label}`}>
    <View className="flex-row items-center justify-between">
      <CustomText className="text-xs text-muted-foreground">Sent today</CustomText>
      <CustomText className={cn("font-sans-semibold text-xs", paused ? "text-muted-foreground" : full ? "text-warning-fg" : "text-foreground")}>{label}</CustomText>
    </View>
    <View className="h-1.5 overflow-hidden rounded-full bg-border">
      {!paused && <View className={cn("h-full rounded-full", full ? "bg-warning-solid" : "bg-primary")} style={{ width: `${(sent / cap) * 100}%` }} />}
    </View>
  </View>;
}
