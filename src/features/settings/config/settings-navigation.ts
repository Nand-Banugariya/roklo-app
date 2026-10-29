import {
  Bell,
  LockKeyhole,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react-native";

export const SETTINGS_GROUPS = [
  {
    label: "Account",
    items: [
      { id: "profile", label: "Profile", icon: UserRound },
      { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
      { id: "security", label: "Security", icon: LockKeyhole },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "general", label: "General", icon: Settings2 },
      { id: "numbers", label: "WhatsApp numbers", icon: Smartphone },
      { id: "team", label: "Team", icon: UsersRound },
      { id: "alerts", label: "Alerts", icon: Bell },
    ],
  },
] as const;

export type SettingsSectionId = (typeof SETTINGS_GROUPS)[number]["items"][number]["id"];

export function settingsSection(value: unknown, canManage: boolean): SettingsSectionId {
  const item = SETTINGS_GROUPS.flatMap((group) => [...group.items]).find(
    (item) => item.id === value,
  );
  if (!item || (!canManage && ["general", "numbers", "alerts"].includes(item.id))) {
    return canManage ? "general" : "profile";
  }
  return item.id;
}
