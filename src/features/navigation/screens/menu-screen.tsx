import { router, type Href } from "expo-router";
import {
  Activity,
  Bot,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Smartphone,
  Tags,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { isConnected } from "@/features/messaging/types";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import { MenuRow } from "../components/menu-row";
import { MotionPressable } from "../components/motion-pressable";
import { TabScreen } from "../components/tab-screen";

type Row = {
  title: string;
  description?: string;
  icon: LucideIcon;
  href: Href;
  workspaceScoped?: boolean;
};

/** The More tab: every destination that does not fit in the bottom bar, grouped like a native settings list. */
export function MenuScreen() {
  const workspace = useAppSelector(selectActiveWorkspace);
  const { numbers } = useMessaging();
  const disabled = workspace?.status === "DISABLED";
  const offline = numbers.filter((number) => !isConnected(number)).length;
  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "Messaging",
      rows: [
        {
          title: "Templates",
          description: "Your saved messages",
          icon: FileText,
          href: "/templates",
          workspaceScoped: true,
        },
        {
          title: "Groups",
          description: "Your customer lists",
          icon: Users,
          href: "/groups",
          workspaceScoped: true,
        },
        {
          title: "Tags",
          description: "Organize customers with labels",
          icon: Tags,
          href: "/tags",
          workspaceScoped: true,
        },
        {
          title: "Message activity",
          description: "Sent, delivered, read and failed",
          icon: Activity,
          href: "/activity",
          workspaceScoped: true,
        },
      ],
    },
    {
      title: "Workspace",
      rows: [
        {
          title: "WhatsApp numbers",
          icon: Smartphone,
          href: "/connections",
          workspaceScoped: true,
          description: numbers.length
            ? `${numbers.length} linked${offline ? ` · ${offline} disconnected` : ""}`
            : "Link a number with a code",
        },
        {
          title: "Team",
          description: "Members and roles",
          icon: UsersRound,
          href: { pathname: "/settings", params: { section: "team" } },
        },
        {
          title: "AI connections",
          description: "Use Roklo with your AI assistants",
          icon: Bot,
          href: "/ai-connections",
          workspaceScoped: true,
        },
        {
          title: "Overview",
          description: "Your workspace at a glance",
          icon: LayoutDashboard,
          href: "/dashboard",
          workspaceScoped: true,
        },
      ],
    },
    {
      title: "Account",
      rows: [
        { title: "Settings", icon: Settings, href: "/settings" },
        { title: "Your account", icon: UserRound, href: "/account" },
        { title: "Workspaces", icon: Building2, href: "/workspaces" },
      ],
    },
  ];
  return (
    <TabScreen tab="more">
      <ScrollView
        className="flex-1 bg-card"
        contentContainerClassName="pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <MotionPressable
          role="button"
          accessibilityLabel="Switch workspace"
          onPress={() => router.push("/workspaces")}
          className="mx-5 mb-2 mt-2 flex-row items-center gap-3 rounded-xl bg-accent p-4"
        >
          <CustomAvatar name={workspace?.name} src={workspace?.logo} square size={44} />
          <View className="min-w-0 flex-1 gap-1">
            <CustomText className="font-sans-semibold text-base" numberOfLines={1}>
              {workspace?.name ?? "Your workspace"}
            </CustomText>
            <CustomText className="text-xs text-muted-foreground">Switch workspace</CustomText>
          </View>
          <CustomText className="font-sans-semibold text-primary">Switch</CustomText>
        </MotionPressable>
        {sections.map((section) => (
          <View key={section.title} accessibilityLabel={section.title}>
            <CustomText
              role="heading"
              className="px-5 pb-1 pt-5 font-sans-medium text-[11px] tracking-[1.5px] text-muted-foreground"
            >
              {section.title.toUpperCase()}
            </CustomText>
            {section.rows.map((row) => (
              <MenuRow
                key={row.title}
                title={row.title}
                description={row.description}
                icon={row.icon}
                disabled={disabled && row.workspaceScoped}
                onPress={() => router.push(row.href)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </TabScreen>
  );
}
