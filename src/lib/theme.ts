import { DarkTheme, DefaultTheme, type Theme } from "expo-router";

import { themeTokens } from "./theme-tokens";

export { themeTokens } from "./theme-tokens";

function makeNavigationTheme(mode: "light" | "dark"): Theme {
  const tokens = themeTokens[mode];
  return {
    ...(mode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      background: tokens.background,
      border: tokens.border,
      card: tokens.card,
      notification: tokens.destructive,
      primary: tokens.primary,
      text: tokens.foreground,
    },
    fonts: {
      regular: { fontFamily: "Geist_400Regular", fontWeight: "400" },
      medium: { fontFamily: "Geist_500Medium", fontWeight: "500" },
      bold: { fontFamily: "Geist_700Bold", fontWeight: "700" },
      heavy: { fontFamily: "Geist_700Bold", fontWeight: "700" },
    },
  };
}

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: makeNavigationTheme("light"),
  dark: makeNavigationTheme("dark"),
};
