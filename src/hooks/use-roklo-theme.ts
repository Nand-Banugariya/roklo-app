import { useColorScheme } from "nativewind";

import { themeTokens } from "@/lib/theme";

export function useRokloTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const mode: "light" | "dark" = colorScheme === "dark" ? "dark" : "light";
  return { colors: themeTokens[mode], mode, setColorScheme };
}
