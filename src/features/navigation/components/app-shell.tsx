import { router, usePathname } from "expo-router";
import { useEffect, type PropsWithChildren } from "react";
import { Keyboard, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { MessagingProvider } from "@/features/messaging/providers/messaging-provider";
import { NotificationsProvider } from "@/features/notifications/providers/notifications-provider";
import { loadWorkspaces, refreshWorkspace } from "@/features/workspaces/services/workspace-service";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { activeDestination, APP_DESTINATIONS, type DestinationId } from "../config/navigation";
import { AppShellContext, type ShellPanel } from "../providers/app-shell-context";
import { DesktopSidebar } from "./desktop-sidebar";

export function AppShell({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const workspace = useAppSelector(selectActiveWorkspace);
  const workspaceState = useAppSelector((state) => state.workspace);
  useEffect(() => {
    void dispatch(loadWorkspaces());
  }, [dispatch, user?.id]);
  return (
    <NotificationsProvider key={user?.id} userId={user?.id ?? ""}>
      <MessagingProvider
        key={`${user?.id}:${workspace?.id}:${workspace?.status}`}
        userId={user?.id ?? ""}
        workspaceId={workspace?.status === "DISABLED" ? "" : (workspace?.id ?? "")}
      >
        <ShellContent
          workspaceError={workspaceState.error || workspaceState.detailError}
          onRetry={() =>
            void dispatch(
              workspaceState.error || !workspace
                ? loadWorkspaces(true)
                : refreshWorkspace(workspace.id),
            )
          }
        >
          {children}
        </ShellContent>
      </MessagingProvider>
    </NotificationsProvider>
  );
}

function ShellContent({
  children,
  workspaceError,
  onRetry,
}: PropsWithChildren<{ workspaceError: string | null; onRetry: () => void }>) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const workspace = useAppSelector(selectActiveWorkspace);
  const current = activeDestination(pathname);
  const disabled = workspace?.status === "DISABLED";
  function openPanel(next: ShellPanel) {
    Keyboard.dismiss();
    router.push(`/${next}`);
  }
  function navigate(id: DestinationId) {
    if (disabled && id !== "settings") return;
    Keyboard.dismiss();
    router.navigate(APP_DESTINATIONS.find((item) => item.id === id)!.href);
  }
  return (
    <AppShellContext.Provider value={{ openPanel }}>
      {/* One safe area for every screen: switching it between tab and detail screens resized the stack
        mid-transition. Tab screens draw their own header and tabs (TabScreen). */}
      <SafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1 bg-card">
        <View className="flex-1 flex-row bg-card">
          {wide && (
            <DesktopSidebar
              activeId={current?.id}
              disabled={disabled}
              onNavigate={navigate}
              onAccount={() => openPanel("account")}
            />
          )}
          <View className="min-w-0 flex-1">
            {workspaceError && (
              <View className="gap-2 border-b border-border px-5 py-3">
                <CustomAlert tone="warning">{workspaceError}</CustomAlert>
                <CustomButton variant="link" size="sm" onPress={onRetry}>
                  Try again
                </CustomButton>
              </View>
            )}
            <View className="min-h-0 flex-1">{children}</View>
          </View>
        </View>
      </SafeAreaView>
    </AppShellContext.Provider>
  );
}
