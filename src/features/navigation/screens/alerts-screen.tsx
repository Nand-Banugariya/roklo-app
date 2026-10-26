import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Bell, CheckCheck, Settings, WifiOff } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { isConnected, numberName, numberPhone } from "@/features/messaging/types";
import { InboxSkeleton, InboxState } from "@/features/messaging/components/inbox-state";
import { MenuRow } from "../components/menu-row";
import { ScreenHeader } from "../components/screen-header";

export function AlertsScreen() {
  const { numbers, loading, error, refreshNumbers } = useMessaging();
  useFocusEffect(useCallback(() => { if (!loading) void refreshNumbers(); }, [refreshNumbers, loading]));
  const disconnected = numbers.filter((number) => !isConnected(number));
  return <View className="flex-1 bg-card"><ScreenHeader title="Alerts" />
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <CustomText className="px-5 pb-2 pt-6 font-sans-semibold text-xs text-muted-foreground">WHATSAPP CONNECTIONS</CustomText>
      {loading ? <InboxSkeleton /> : error ? <InboxState icon={Bell} title="Couldn't check your numbers" description={error} action="Open WhatsApp numbers" onAction={() => router.push("/connections")} />
        : disconnected.length ? disconnected.map((number) => <MenuRow key={number.id} title={`${numberName(number)} disconnected`} description={`${numberPhone(number)} · Tap to reconnect`} icon={WifiOff}
          onPress={() => router.push({ pathname: "/connect-number", params: { sessionId: number.id } })} />)
        : <InboxState icon={CheckCheck} title={numbers.length ? "Your numbers are connected" : "No connection alerts"} description={numbers.length ? "You're ready to keep your conversations moving." : "Connect a WhatsApp number to start receiving connection alerts."} />}
      <View className="border-t border-border"><MenuRow title="Alert preferences" description="Choose when your team hears from Roklo" icon={Settings} onPress={() => router.push({ pathname: "/settings", params: { section: "alerts" } })} /></View>
    </ScrollView>
  </View>;
}
