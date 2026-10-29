import { Linking, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomSwitch } from "@/components/shadcn-custom/customswitch";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { SettingsDescription, SettingsRow } from "@/features/settings/components/settings-section";
import { useNotifications } from "../providers/notifications-provider";

export function PushNotificationSettings() {
  const notifications = useNotifications();
  const { incoming, busy, unavailable } = notifications;
  return (
    <View className="gap-4">
      <View className="gap-3">
        <SettingsRow
          title="Phone notifications"
          divided
          inline
          description="Receive mentions in private notes and enabled message alerts on this phone."
        >
          <CustomSwitch
            accessibilityLabel="Phone notifications"
            checked={notifications.enabled}
            disabled={busy || !!unavailable}
            onCheckedChange={(enabled) => void notifications.setEnabled(enabled)}
          />
        </SettingsRow>
        {unavailable ? (
          <SettingsDescription>{unavailable}</SettingsDescription>
        ) : (
          <>
            <CustomText
              accessibilityLiveRegion="polite"
              className="text-xs leading-5 text-muted-foreground"
            >
              {busy
                ? "Updating notifications…"
                : notifications.enabled
                  ? "Phone notifications are on."
                  : "Phone notifications are off."}
            </CustomText>
            <SettingsDescription>
              Turning this off, or signing out here, stops app push notifications on all phones
              registered to this account. Enable them again on each phone to resume.
            </SettingsDescription>
          </>
        )}
        {notifications.message && <CustomAlert tone="warning">{notifications.message}</CustomAlert>}
        {notifications.blocked && (
          <CustomButton
            variant="link"
            onPress={() => void Linking.openSettings().catch(() => undefined)}
          >
            Open phone settings
          </CustomButton>
        )}
        {notifications.message && !notifications.blocked && !unavailable && (
          <CustomButton
            variant="link"
            disabled={busy}
            onPress={() => void notifications.retryDevice()}
          >
            Retry phone notifications
          </CustomButton>
        )}
      </View>
      <View className="gap-3">
        <SettingsRow
          title="Incoming messages"
          divided
          inline
          description="Notify me when a new WhatsApp message arrives on a number I can access. Muted chats stay quiet."
        >
          <CustomSwitch
            accessibilityLabel="Incoming message notifications"
            checked={incoming.enabled}
            disabled={busy || !!unavailable || !incoming.loaded}
            onCheckedChange={(enabled) => void notifications.setIncomingEnabled(enabled)}
          />
        </SettingsRow>
        {!unavailable && (
          <>
            <CustomText
              accessibilityLiveRegion="polite"
              className="text-xs leading-5 text-muted-foreground"
            >
              {busy
                ? "Updating notification preferences…"
                : !incoming.loaded
                  ? "Incoming message preference is unavailable."
                  : incoming.enabled
                    ? "Incoming message notifications are enabled for your account."
                    : "Incoming message notifications are off."}
            </CustomText>
            <SettingsDescription>
              This preference applies across your devices and workspaces. Turning it off keeps
              mention notifications on.
            </SettingsDescription>
            {incoming.enabled && !notifications.enabled && (
              <SettingsDescription>
                Turn on Phone notifications to receive incoming messages here.
              </SettingsDescription>
            )}
          </>
        )}
        {incoming.message && <CustomAlert tone="warning">{incoming.message}</CustomAlert>}
        {incoming.message && !unavailable && (
          <CustomButton
            variant="link"
            disabled={busy}
            onPress={() => void notifications.retryIncoming()}
          >
            Retry incoming messages
          </CustomButton>
        )}
      </View>
    </View>
  );
}
