import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";
import type { DestinationId } from "../config/navigation";
import { useAppShell } from "../providers/app-shell-context";
import { ScreenHeader } from "./screen-header";
import { TabScreen } from "./tab-screen";

export function PageLayout({
  title,
  description,
  children,
  accountPage,
  hideHeader,
  tab,
}: {
  title: string;
  description: string;
  children: ReactNode;
  accountPage?: boolean;
  hideHeader?: boolean;
  /** A bottom-tab screen (Broadcast, Contacts): its tab header and tabs instead of a Back header. */
  tab?: DestinationId;
}) {
  const workspace = useAppSelector(selectActiveWorkspace);
  const { openPanel } = useAppShell();
  const disabled = workspace?.status === "DISABLED" && !accountPage;
  const page = (
    <View className="flex-1 bg-card">
      {!tab && !hideHeader && <ScreenHeader title={title} />}
      <ScrollView
        className="flex-1 bg-ink-50"
        contentContainerStyle={{ flexGrow: 1 }}
        contentContainerClassName="items-center"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View
          key={workspace?.id ?? "workspace"}
          className="w-full max-w-[1100px] gap-6 px-5 pb-8 pt-7 sm:px-8 sm:pt-9"
        >
          <View className="gap-2">
            <CustomText className="text-sm leading-6 text-ink-600 dark:text-white">
              {description}
            </CustomText>
          </View>
          {disabled ? (
            <View className="gap-5 py-8">
              <CustomAlert tone="warning" title="Workspace disabled">
                This workspace has been disabled. Choose another workspace or contact your workspace
                owner.
              </CustomAlert>
              <CustomButton size="xl" onPress={() => openPanel("workspaces")}>
                Choose a workspace
              </CustomButton>
            </View>
          ) : (
            children
          )}
        </View>
      </ScrollView>
    </View>
  );
  return tab ? <TabScreen tab={tab}>{page}</TabScreen> : page;
}
