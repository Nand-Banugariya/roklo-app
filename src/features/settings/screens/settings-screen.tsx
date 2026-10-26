import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import { PageLayout } from "@/features/navigation/components/page-layout";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import {
  PreferencesSection,
  ProfileSection,
  SecuritySection,
} from "../components/account-sections";
import { SettingsNavigation } from "../components/settings-navigation";
import { TeamSection } from "../components/team-section";
import {
  AlertsSection,
  GeneralSection,
  NumbersSection,
} from "../components/workspace-sections";
import { settingsSection } from "../config/settings-navigation";

const PAGE_COPY = {
  profile: {
    title: "Account",
    description: "Your profile, preferences and active sessions.",
  },
  preferences: {
    title: "Preferences",
    description: "Choose how Roklo looks and works for you.",
  },
  security: {
    title: "Security",
    description: "Your sign-in method and active sessions.",
  },
  general: {
    title: "Workspace settings",
    description: "Your workspace details and preferences.",
  },
  numbers: {
    title: "WhatsApp numbers",
    description: "Manage the numbers linked to your workspace.",
  },
  team: {
    title: "Team",
    description: "Your teammates, roles and shared teams.",
  },
  alerts: {
    title: "Alerts",
    description: "Choose when your workspace needs to hear from us.",
  },
} as const;

/** UI-only settings: reads the existing session/workspace, never loads or saves settings. */
export default function SettingsScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const workspace = useAppSelector(selectActiveWorkspace);
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { width } = useWindowDimensions();
  const canManage = workspace?.role === "OWNER";
  const active = settingsSection(section, canManage);
  const page = PAGE_COPY[active];
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Settings" />
      <View className={width >= 1100 ? "flex-1 flex-row" : "flex-1"}>
        <SettingsNavigation
          active={active}
          onChange={(next) => {
            Keyboard.dismiss();
            router.setParams({ section: next });
          }}
          wide={width >= 1100}
          canManage={canManage}
          workspaceName={workspace?.name}
        />
        <PageLayout
          key={`${user?.id}:${workspace?.id}:${active}`}
          title={page.title}
          description={page.description}
          accountPage
          hideHeader
        >
          <View
            key={`${user?.id}:${workspace?.id}:${active}`}
            className="gap-4"
          >
            {active === "profile" && (
              <ProfileSection user={user} workspace={workspace} />
            )}
            {active === "preferences" && <PreferencesSection />}
            {active === "security" && <SecuritySection />}
            {active === "general" && <GeneralSection workspace={workspace} />}
            {active === "numbers" && <NumbersSection />}
            {active === "team" && <TeamSection canManage={canManage} />}
            {active === "alerts" && <AlertsSection />}
          </View>
        </PageLayout>
      </View>
    </KeyboardAvoidingView>
  );
}
