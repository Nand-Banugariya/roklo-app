import { router } from "expo-router";
import { ArrowLeftRight } from "lucide-react-native";
import { Keyboard, View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useMessaging } from "../providers/messaging-provider";
import { connectionState, numberName, numberPhone } from "../types";
import { PulseHalo } from "./connection-pulse";

/**
 * The number the inbox is working from, as a compact bordered pill with a switch arrow so it reads
 * as tappable: status dot, name, phone (or what's wrong). Opens the numbers screen to switch.
 */
export function ActiveNumberBar({ disabled }: { disabled?: boolean }) {
  const { activeNumber, numbers } = useMessaging();
  const { colors } = useRokloTheme();
  // Nothing until the connection is known, and nothing for first-time users: the inbox's link prompt carries that message.
  if (!activeNumber) return null;
  const state = connectionState(activeNumber);
  const connected = state === "connected";
  if (!connected && !activeNumber.phoneNumber) return null;
  const connecting = state === "connecting";
  const warn = !connected && !connecting;
  const name = numberName(activeNumber);
  const phone = activeNumber.phoneNumber ? numberPhone(activeNumber) : null;
  const detail = connected ? (phone && phone !== name ? phone : null) : connecting ? "Connecting…" : "Not connected";
  const dot = warn ? colors["warning-solid"] : colors.primary;
  function open() { Keyboard.dismiss(); router.push("/connections"); }

  return <MotionPressable role="button" disabled={disabled} accessibilityState={{ disabled: !!disabled, busy: connecting }}
    accessibilityLabel={`Working from ${name}${detail ? `, ${detail}` : ""}. ${numbers.length > 1 ? "Switch number" : "Open WhatsApp numbers"}`}
    accessibilityHint="Open the WhatsApp numbers screen" onPress={open}
    className={cn("h-10 max-w-full self-start flex-row items-center gap-2 rounded-full border pl-3 pr-2.5 active:bg-accent",
      warn ? "border-warning-border bg-warning-pill-bg" : "border-border bg-background", disabled && "opacity-40")}>
    {connected ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
      : <PulseHalo size={8} color={dot}><View className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /></PulseHalo>}
    <CustomText numberOfLines={1} className={cn("shrink-0 font-sans-semibold text-sm", warn ? "text-warning-pill-fg" : "text-foreground")}>{name}</CustomText>
    {detail && <CustomText numberOfLines={1} className={cn("shrink text-xs", warn ? "text-warning-pill-fg" : "text-muted-foreground")}>{detail}</CustomText>}
    <CustomIcon as={ArrowLeftRight} size={14} className={warn ? "text-warning-pill-fg" : "text-muted-foreground"} />
  </MotionPressable>;
}
