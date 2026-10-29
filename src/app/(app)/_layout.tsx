import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { AppShell } from "@/features/navigation/components/app-shell";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

export const unstable_settings = { initialRouteName: "inbox" };
export default function AppLayout() {
  const { colors } = useRokloTheme();
  const reducedMotion = useReducedMotion();
  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.card },
          animation: reducedMotion ? "none" : "slide_from_right",
          animationDuration: 240,
        }}
      >
        <Stack.Screen name="inbox" options={{ title: "Chats", animation: "none" }} />
        <Stack.Screen name="broadcasts" options={{ title: "Broadcast", animation: "none" }} />
        <Stack.Screen name="contacts" options={{ title: "Contacts", animation: "none" }} />
        <Stack.Screen name="connections" options={{ title: "WhatsApp numbers" }} />
        <Stack.Screen name="menu" options={{ title: "Menu", animation: "none" }} />
      </Stack>
    </AppShell>
  );
}
