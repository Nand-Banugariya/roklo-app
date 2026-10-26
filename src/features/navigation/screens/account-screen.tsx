import { router } from "expo-router";
import { ShellPanels } from "../components/shell-panels";
import { goBack } from "../components/screen-header";
import { APP_DESTINATIONS } from "../config/navigation";
import type { ShellPanel } from "../providers/app-shell-context";

export function AccountScreen({ panel }: { panel: Exclude<ShellPanel, "menu"> }) {
  return <ShellPanels panel={panel} onClose={goBack}
    onPanel={(next) => router.push(`/${next}`)}
    onNavigate={(id) => router.navigate(APP_DESTINATIONS.find((item) => item.id === id)!.href)} />;
}
