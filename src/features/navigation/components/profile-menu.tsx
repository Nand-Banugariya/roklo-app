import { router } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ChevronRight, LogOut, Moon, Settings, Sun, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Keyboard, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { Pressable } from "@/components/ui/pressable";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthSession } from "@/features/auth/providers/session-provider";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { themeTokens } from "@/lib/theme";
import { useAppSelector } from "@/store/hooks";

/** "+919876543210" → "+91 98765 43210"; as stored when it can't be read. */
function formatMobile(mobileNumber: string) {
  const e164 = `+${mobileNumber.replace(/^\+/, "")}`;
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.isValid() ? parsed.formatInternational() : e164;
}

/**
 * The profile photo in each tab's header, opening a compact popup under it: who's signed in, a dark-mode
 * switch, Settings and Sign out (straight away, no confirmation).
 */
export function ProfileMenu() {
  const user = useAppSelector((state) => state.auth.user);
  const { signOut } = useAuthSession();
  const { width } = useWindowDimensions();
  const [signingOut, setSigningOut] = useState(false);
  const contact = user?.mobileNumber ? formatMobile(user.mobileNumber) : user?.email;
  // Straight out, no confirmation; a second tap while it's going does nothing.
  async function signOutNow() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
  }
  return (
    <Popover>
      <PopoverTrigger asChild onPress={() => Keyboard.dismiss()}>
        <Pressable
          role="button"
          accessibilityLabel="Your profile"
          accessibilityHint="Shows your profile, dark mode and sign out"
          className="h-[46px] w-[46px] items-center justify-center rounded-full active:opacity-80"
        >
          <CustomAvatar name={user?.name} src={user?.image} size={40} />
        </Pressable>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={4}
        avoidCollisions
        insets={{ left: 16, right: 16 }}
        accessibilityLabel="Your profile"
        className="overflow-hidden rounded-2xl p-0"
        style={{ width: Math.min(276, width - 32) }}
      >
        <View className="flex-row items-center gap-3 border-b border-border px-3.5 py-3.5">
          <CustomAvatar name={user?.name} src={user?.image} size={42} />
          <View className="min-w-0 flex-1">
            <CustomText numberOfLines={1} className="font-sans-semibold text-base">
              {user?.name || "Your account"}
            </CustomText>
            {!!contact && (
              <CustomText selectable numberOfLines={1} className="text-sm text-muted-foreground">
                {contact}
              </CustomText>
            )}
          </View>
        </View>

        <View className="p-1">
          <DarkModeRow />
          <MenuRow icon={Settings} label="Settings" onPress={() => router.push("/settings")} />
          <Pressable
            role="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            disabled={signingOut}
            onPress={() => void signOutNow()}
            className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-accent"
          >
            {signingOut ? (
              <CustomSpinner size="small" accessibilityLabel="Signing out" />
            ) : (
              <CustomIcon as={LogOut} size={19} className="text-error-fg" />
            )}
            <CustomText className="flex-1 font-sans-medium text-[15px] text-error-fg">
              {signingOut ? "Signing out…" : "Sign out"}
            </CustomText>
          </Pressable>
        </View>
      </PopoverContent>
    </Popover>
  );
}

// Fixed colours (not the current theme's), so the track doesn't jump as the theme itself changes.
const TRACK_OFF = themeTokens.light["ink-300"];
const TRACK_ON = themeTokens.dark.primary;
const TRACK = { width: 46, height: 28, pad: 3 };
const SWITCH_SPRING = { damping: 16, stiffness: 180, mass: 0.8 };
// About when the knob has slid across: the theme changes then, not on the tap.
const THEME_AFTER_MS = 260;
const THUMB = TRACK.height - TRACK.pad * 2;

/**
 * Dark mode as a switch: the knob slides across with a spring, its sun turns into a moon, and the track
 * fills green. Still under reduced motion. The popup stays open, so the new theme shows straight away.
 * The knob moves first and the theme follows once it has slid (THEME_AFTER_MS): switching the theme
 * restyles every screen behind the popup, and done on the tap it held up the knob, which stuttered.
 */
function DarkModeRow() {
  const { mode, setColorScheme } = useRokloTheme();
  const dark = mode === "dark";
  const reduced = useReducedMotion();
  const on = useSharedValue(dark ? 1 : 0);
  useEffect(() => {
    on.value = reduced ? (dark ? 1 : 0) : withSpring(dark ? 1 : 0, SWITCH_SPRING);
  }, [dark, reduced, on]);
  // The theme the knob is heading to, until it's applied; a second tap meanwhile turns it back.
  const [pending, setPending] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setColorScheme(pending);
      setPending(null);
    }, THEME_AFTER_MS);
    return () => clearTimeout(timer);
  }, [pending, setColorScheme]);
  const toggle = () => {
    const next = (pending ?? mode) === "dark" ? "light" : "dark";
    if (reduced) {
      setColorScheme(next);
      return;
    }
    on.set(withSpring(next === "dark" ? 1 : 0, SWITCH_SPRING));
    setPending(next === mode ? null : next);
  };
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [TRACK_OFF, TRACK_ON]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * (TRACK.width - THUMB - TRACK.pad * 2) }],
  }));
  const sun = useAnimatedStyle(() => ({
    opacity: interpolate(on.value, [0, 0.5], [1, 0], "clamp"),
    transform: [
      { rotate: `${on.value * 180}deg` },
      { scale: interpolate(on.value, [0, 1], [1, 0.4]) },
    ],
  }));
  const moon = useAnimatedStyle(() => ({
    opacity: interpolate(on.value, [0.5, 1], [0, 1], "clamp"),
    transform: [
      { rotate: `${(on.value - 1) * 180}deg` },
      { scale: interpolate(on.value, [0, 1], [0.4, 1]) },
    ],
  }));
  // The row's own icon follows the switch, turning as it changes.
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = 0;
    spin.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) });
  }, [dark, reduced, spin]);
  const rowIcon = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${(1 - spin.value) * -90}deg` },
      { scale: interpolate(spin.value, [0, 1], [0.6, 1]) },
    ],
  }));

  return (
    <Pressable
      role="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: (pending ?? mode) === "dark" }}
      onPress={toggle}
      className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-accent"
    >
      <Animated.View style={rowIcon}>
        <CustomIcon as={dark ? Moon : Sun} size={19} className="text-ink-700" />
      </Animated.View>
      <CustomText className="flex-1 font-sans-medium text-[15px]">Dark mode</CustomText>
      {/* Style only on the animated views (Reanimated never receives NativeWind class names). */}
      <Animated.View
        style={[
          {
            width: TRACK.width,
            height: TRACK.height,
            borderRadius: TRACK.height / 2,
            padding: TRACK.pad,
          },
          track,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000000",
              shadowOpacity: 0.18,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
            thumb,
          ]}
        >
          <Animated.View style={[{ position: "absolute" }, sun]}>
            <CustomIcon as={Sun} size={13} strokeWidth={2.4} color="#e8a317" />
          </Animated.View>
          <Animated.View style={[{ position: "absolute" }, moon]}>
            <CustomIcon as={Moon} size={12} strokeWidth={2.4} color={TRACK_ON} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** A row that closes the popup and opens its screen. */
function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <PopoverClose asChild>
      <Pressable
        role="button"
        accessibilityLabel={label}
        onPress={onPress}
        className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-accent"
      >
        <CustomIcon as={icon} size={19} className="text-ink-700" />
        <CustomText className="flex-1 font-sans-medium text-[15px]">{label}</CustomText>
        <CustomIcon as={ChevronRight} size={17} className="text-ink-400" />
      </Pressable>
    </PopoverClose>
  );
}
