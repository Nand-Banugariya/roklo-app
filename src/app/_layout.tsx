import "@/global.css";

import { PortalHost } from "@rn-primitives/portal";
import { useFonts } from "expo-font";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SessionBoundary } from "@/features/auth/components/session-boundary";
import { SessionProvider } from "@/features/auth/providers/session-provider";
import { selectShowOnboarding } from "@/features/onboarding/store/onboarding-selectors";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { ROKLO_FONTS } from "@/lib/fonts";
import { NAV_THEME } from "@/lib/theme";
import { useAppSelector } from "@/store/hooks";
import { StoreProvider } from "@/store/store-provider";

SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const user = useAppSelector((state) => state.auth.user);
  const showOnboarding = useAppSelector(selectShowOnboarding);
  const { colors } = useRokloTheme();
  // The launch screens share the intro's tint, so nothing white shows between
  // the logo and the login page.
  // A soft cross-fade between the intro and login; both share this tint.
  const tinted = {
    animation: "fade" as const,
    contentStyle: { backgroundColor: colors["brand-100"] },
  };
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" options={tinted} />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={tinted} />
      </Stack.Protected>
      <Stack.Protected guard={showOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && user.isOnboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="components" />
        <Stack.Screen name="explore" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(ROKLO_FONTS);
  const { mode, colors } = useRokloTheme();

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={NAV_THEME[mode]}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <View className="flex-1 bg-background">
          <StoreProvider>
            <SessionProvider>
              <SessionBoundary>
                <AppNavigator />
              </SessionBoundary>
            </SessionProvider>
          </StoreProvider>
          <PortalHost />
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
