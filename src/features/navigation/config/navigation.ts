export const APP_DESTINATIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    description: "Your workspace at a glance",
    icon: "dashboard",
  },
  {
    id: "connections",
    label: "WhatsApp numbers",
    href: "/connections",
    description: "Your WhatsApp numbers",
    icon: "connections",
  },
  {
    id: "inbox",
    label: "Chats",
    href: "/inbox",
    description: "Customer conversations",
    icon: "inbox",
  },
  {
    id: "contacts",
    label: "Contacts",
    href: "/contacts",
    description: "The people you reach",
    icon: "contacts",
  },
  {
    id: "groups",
    label: "Groups",
    href: "/groups",
    description: "Organize your audience",
    icon: "groups",
  },
  {
    id: "broadcasts",
    label: "Broadcast",
    href: "/broadcasts",
    description: "Updates that feel personal",
    icon: "broadcasts",
  },
  {
    id: "templates",
    label: "Templates",
    href: "/templates",
    description: "Messages ready to send",
    icon: "templates",
  },
  {
    id: "activity",
    label: "Message activity",
    href: "/activity",
    description: "What happens in your workspace",
    icon: "activity",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    description: "Your profile and preferences",
    icon: "settings",
  },
  {
    id: "tags",
    label: "Tags",
    href: "/tags",
    description: "Labels for your customers",
    icon: "tags",
  },
  {
    id: "ai-connections",
    label: "AI connections",
    href: "/ai-connections",
    description: "Use Roklo with your AI assistants",
    icon: "ai-connections",
  },
] as const;
export type DestinationId = (typeof APP_DESTINATIONS)[number]["id"];
export type AppDestination = (typeof APP_DESTINATIONS)[number];
export const PRIMARY_DESTINATIONS: readonly DestinationId[] = ["inbox", "broadcasts", "contacts"];
export function activeDestination(pathname: string) {
  const path = pathname.split(/[?#]/)[0];
  return (
    APP_DESTINATIONS.find((item) => path === item.href || path.startsWith(`${item.href}/`)) ?? null
  );
}
export const isPrimaryDestination = (id?: string) =>
  PRIMARY_DESTINATIONS.some((value) => value === id);
/** The last bottom tab: a full screen listing every secondary destination. */
export const MORE_HREF = "/menu";
/** Top-level tab screens: they show the module header and bottom navigation, never a Back header. */
export function isTabRoot(pathname: string) {
  const path = pathname.split(/[?#]/)[0];
  return (
    path === MORE_HREF ||
    PRIMARY_DESTINATIONS.some(
      (id) => APP_DESTINATIONS.find((item) => item.id === id)!.href === path,
    )
  );
}
