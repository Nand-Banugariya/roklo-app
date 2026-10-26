import {
  Activity,
  Bot,
  ContactRound,
  FileText,
  MessageCircle,
  LayoutDashboard,
  Megaphone,
  Plug,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import type { DestinationId } from "./navigation";

export const NAVIGATION_ICONS: Record<DestinationId, LucideIcon> = {
  dashboard: LayoutDashboard,
  connections: Plug,
  inbox: MessageCircle,
  contacts: ContactRound,
  groups: Users,
  broadcasts: Megaphone,
  templates: FileText,
  activity: Activity,
  settings: Settings,
  tags: Tags,
  "ai-connections": Bot,
};
