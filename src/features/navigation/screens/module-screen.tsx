import { router } from "expo-router";
import { ArrowUpRight, Building2 } from "lucide-react-native";
import { View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomNavItem } from "@/components/shadcn-custom/customnavitem";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import { APP_DESTINATIONS, isPrimaryDestination, type DestinationId } from "../config/navigation";
import { NAVIGATION_ICONS } from "../config/navigation-icons";
import { useAppShell } from "../providers/app-shell-context";
import { PageLayout } from "../components/page-layout";

type ModuleId = Exclude<DestinationId, "settings">;
const copy: Record<
  ModuleId,
  {
    title: string;
    description: string;
    heading: string;
    body: string;
    action: DestinationId;
    related: DestinationId[];
  }
> = {
  dashboard: {
    title: "Dashboard",
    description: "Your workspace, all in one place.",
    heading: "Welcome to your workspace",
    body: "Open your inbox, connect your business WhatsApp numbers, or explore your contacts to keep your customer conversations moving.",
    action: "inbox",
    related: ["connections", "contacts", "activity"],
  },
  inbox: {
    title: "Chats",
    description: "Every customer conversation, in one place.",
    heading: "Closer to your customers",
    body: "Bring your business WhatsApp conversations into a shared space for your team. Connections is where your WhatsApp numbers live.",
    action: "connections",
    related: ["contacts", "groups"],
  },
  connections: {
    title: "WhatsApp numbers",
    description: "A home for your business WhatsApp numbers.",
    heading: "Your team starts with a connection",
    body: "Your WhatsApp numbers connect your workspace to customers. Move between your inbox, contacts and messages from one place.",
    action: "inbox",
    related: ["contacts", "settings"],
  },
  contacts: {
    title: "Contacts",
    description: "Keep the people behind every conversation close.",
    heading: "An audience you know",
    body: "Contacts, groups and conversations belong together. Explore the tools in your workspace to stay in touch with customers.",
    action: "groups",
    related: ["inbox", "broadcasts"],
  },
  groups: {
    title: "Groups",
    description: "Keep your audience organized.",
    heading: "The right people, together",
    body: "Group your audience around the way your business works, and move easily between contacts and customer updates.",
    action: "contacts",
    related: ["broadcasts", "inbox"],
  },
  broadcasts: {
    title: "Broadcast",
    description: "Customer updates that feel personal.",
    heading: "Make every update count",
    body: "Announcements, offers and follow-ups start with your audience and a message. Keep contacts and templates close at hand.",
    action: "templates",
    related: ["contacts", "activity"],
  },
  templates: {
    title: "Templates",
    description: "A place for the messages you send often.",
    heading: "Good conversations start here",
    body: "Bring a consistent voice to customer updates, reminders and follow-ups. Your workspace keeps messages and audiences together.",
    action: "broadcasts",
    related: ["contacts", "inbox"],
  },
  activity: {
    title: "Message activity",
    description: "Keep track of what happens in your workspace.",
    heading: "Stay in the loop",
    body: "Your workspace connects conversations, customer updates and team activity. Jump into a section to continue your work.",
    action: "inbox",
    related: ["broadcasts", "connections"],
  },
  tags: {
    title: "Tags",
    description: "Find the right customers with labels.",
    heading: "Keep your customers organized",
    body: "Labels like VIP or New customer help your team find and recognize customers. Manage your audience from Contacts.",
    action: "contacts",
    related: ["contacts", "groups"],
  },
  "ai-connections": {
    title: "AI connections",
    description: "Use Roklo with your AI assistants.",
    heading: "Your assistant, connected to your business",
    body: "Authorize an AI assistant to help with customers, messages and broadcasts. Your connected assistants will appear here when connection management is available.",
    action: "settings",
    related: ["templates", "broadcasts"],
  },
};

/** Entry frames for the business modules; they contain navigation, never mock data. */
export function ModuleScreen({ module }: { module: ModuleId }) {
  const content = copy[module];
  const workspace = useAppSelector(selectActiveWorkspace);
  const { openPanel } = useAppShell();
  const action = APP_DESTINATIONS.find((item) => item.id === content.action)!;
  return (
    <PageLayout title={content.title} description={content.description} tab={isPrimaryDestination(module) ? module : undefined}>
      <View className="gap-6 rounded-2xl border border-ink-200 bg-card p-6 sm:p-8">
        <View className="h-14 w-14 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50">
          <CustomIcon
            as={NAVIGATION_ICONS[module]}
            size={26}
            strokeWidth={1.6}
            className="text-brand-700"
          />
        </View>
        <View className="max-w-[560px] gap-3">
          <CustomText className="font-sans-semibold text-xl leading-7 text-foreground dark:text-white">
            {content.heading}
          </CustomText>
          <CustomText className="text-sm leading-6 text-ink-600 dark:text-white">
            {content.body}
          </CustomText>
        </View>
        <CustomButton
          variant="primary"
          size="xl"
          className="self-start"
          onPress={() => router.navigate(action.href)}
          trailingIcon={
            <CustomIcon
              as={ArrowUpRight}
              size={17}
              className="text-primary-foreground"
            />
          }
        >
          Open {action.label.toLowerCase()}
        </CustomButton>
      </View>
      <View className="gap-3">
        <CustomText className="font-sans-semibold text-[13px] text-ink-700 dark:text-white">
          Keep exploring
        </CustomText>
        <View className="gap-1 rounded-2xl border border-ink-200 bg-card p-2">
          {content.related.map((id) => {
            const item = APP_DESTINATIONS.find((value) => value.id === id)!;
            return (
              <CustomNavItem
                key={id}
                label={item.label}
                description={item.description}
                icon={NAVIGATION_ICONS[id]}
                chevron
                onPress={() => router.navigate(item.href)}
              />
            );
          })}
        </View>
      </View>
      {workspace && (
        <View className="flex-row items-center gap-3 rounded-xl border border-ink-200 px-4 py-3">
          <CustomIcon as={Building2} size={18} className="text-ink-500" />
          <View className="min-w-0 flex-1 gap-0.5">
            <CustomText className="text-[11px] text-ink-500 dark:text-white">
              CURRENT WORKSPACE
            </CustomText>
            <CustomText
              numberOfLines={1}
              className="font-sans-medium text-[13px] text-foreground dark:text-white"
            >
              {workspace.name}
            </CustomText>
          </View>
          <CustomButton
            variant="ghost"
            size="sm"
            className="min-h-11"
            onPress={() => openPanel("workspaces")}
          >
            Switch
          </CustomButton>
        </View>
      )}
    </PageLayout>
  );
}
