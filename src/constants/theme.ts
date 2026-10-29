/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import { Platform } from "react-native";

import { themeTokens } from "@/lib/theme-tokens";

export const Colors = {
  light: {
    text: themeTokens.light.foreground,
    background: themeTokens.light.background,
    backgroundElement: themeTokens.light["ink-100"],
    backgroundSelected: themeTokens.light["nav-active"],
    textSecondary: themeTokens.light["ink-600"],
  },
  dark: {
    text: themeTokens.dark.foreground,
    background: themeTokens.dark.background,
    backgroundElement: themeTokens.dark["ink-100"],
    backgroundSelected: themeTokens.dark["nav-active"],
    textSecondary: themeTokens.dark["ink-600"],
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  sans: "Geist_400Regular",
  serif: "Newsreader_400Regular",
  rounded: "Geist_400Regular",
  mono: "GeistMono_400Regular",
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
