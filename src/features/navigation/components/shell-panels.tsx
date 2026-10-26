import {
  ArrowLeft,
  Check,
  LogOut,
  RefreshCw,
  Settings,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomNavItem } from "@/components/shadcn-custom/customnavitem";
import { ScreenHeader } from "./screen-header";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useAuthSession } from "@/features/auth/providers/session-provider";
import {
  loadWorkspaces,
  switchWorkspace,
} from "@/features/workspaces/services/workspace-service";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { DestinationId } from "../config/navigation";
import type { ShellPanel } from "../providers/app-shell-context";
import { AppearanceControls } from "./appearance-controls";
import { NavigationList } from "./navigation-list";

export function ShellPanels({
  panel,
  onClose,
  onPanel,
  activeId,
  disabled,
  onNavigate,
}: {
  panel: ShellPanel | null;
  onClose: () => void;
  onPanel: (panel: ShellPanel) => void;
  activeId?: string;
  disabled?: boolean;
  onNavigate: (id: DestinationId) => void;
}) {
  const user = useAppSelector((state) => state.auth.user);
  const [loggingOut, setLoggingOut] = useState(false);
  const { signOut } = useAuthSession();
  const title =
    panel === "menu"
      ? "Explore Roklo"
      : panel === "workspaces"
        ? "Your workspaces"
        : panel === "logout"
          ? "Sign out"
          : "Your account";
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await signOut();
  }
  if (!panel) return null;
  return (
    <View className="flex-1 bg-card">
      <ScreenHeader title={title} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 p-5">
      {panel === "menu" && (
        <NavigationList
          activeId={activeId}
          disabled={disabled}
          onNavigate={onNavigate}
          descriptions
        />
      )}
      {panel === "workspaces" && <WorkspacesPanel onClose={onClose} />}
      {panel === "account" && (
        <View className="gap-6">
          <View className="flex-row items-center gap-3">
            <CustomAvatar name={user?.name} src={user?.image} size={52} />
            <View className="min-w-0 flex-1 gap-1">
              <CustomText className="font-sans-semibold text-base">
                {user?.name || "Your account"}
              </CustomText>
              <CustomText className="text-[13px] text-ink-600">
                {user?.mobileNumber
                  ? `+${user.mobileNumber.replace(/^\+/, "")}`
                  : user?.email}
              </CustomText>
            </View>
          </View>
          <View className="gap-3">
            <CustomText className="font-sans-semibold text-[13px]">
              Appearance
            </CustomText>
            <AppearanceControls />
          </View>
          <View className="gap-1 border-t border-ink-200 pt-3">
            <CustomNavItem
              label="Settings"
              description="Profile and preferences"
              icon={Settings}
              chevron
              onPress={() => onNavigate("settings")}
            />
            <CustomNavItem
              label="Sign out"
              icon={LogOut}
              destructive
              onPress={() => onPanel("logout")}
            />
          </View>
        </View>
      )}
      {panel === "logout" && (
        <View className="gap-5">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-ink-100">
            <CustomIcon as={LogOut} size={23} className="text-ink-700" />
          </View>
          <CustomText className="text-[15px] leading-6 text-ink-700">
            Sign out of your Roklo account on this device? Your workspace and
            conversations will be here when you return.
          </CustomText>
          <CustomButton
            variant="destructive-solid"
            fullWidth
            size="xl"
            loading={loggingOut}
            loadingText="Signing out…"
            onPress={() => void logout()}
          >
            Sign out
          </CustomButton>
          <CustomButton
            variant="secondary"
            fullWidth
            size="xl"
            disabled={loggingOut}
            onPress={() => onPanel("account")}
            leadingIcon={
              <CustomIcon as={ArrowLeft} size={16} className="text-ink-700" />
            }
          >
            Stay signed in
          </CustomButton>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

function WorkspacesPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const dispatch = useAppDispatch();
  const state = useAppSelector((root) => root.workspace);
  const active = useAppSelector(selectActiveWorkspace);
  const items = state.items.filter((workspace) =>
    workspace.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  async function choose(id: string) {
    if (await dispatch(switchWorkspace(id))) onClose();
  }
  return (
    <View className="gap-4">
      {state.items.length > 5 && (
        <CustomInput
          size="xl"
          placeholder="Search workspaces"
          accessibilityLabel="Search workspaces"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      {(state.error || state.switchError) && (
        <CustomAlert tone="error">
          {state.switchError || state.error}
        </CustomAlert>
      )}
      {state.status === "loading" && (
        <View className="items-center py-5">
          <CustomSpinner accessibilityLabel="Loading workspaces" />
        </View>
      )}
      {items.map((workspace) => {
        const selected = workspace.id === active?.id;
        const disabled = workspace.status === "DISABLED";
        const switching = workspace.id === state.switchingId;
        return (
          <Pressable
            key={workspace.id}
            role="radio"
            aria-checked={selected}
            accessibilityState={{
              checked: selected,
              disabled: disabled || !!state.switchingId,
            }}
            accessibilityLabel={`Switch to ${workspace.name}`}
            disabled={disabled || !!state.switchingId}
            onPress={() => void choose(workspace.id)}
            className={cn(
              "min-h-20 flex-row items-center gap-3 rounded-xl border border-ink-200 p-4",
              selected && "border-brand-300 bg-brand-50",
              disabled && "opacity-50",
            )}
          >
            <CustomAvatar
              name={workspace.name}
              src={workspace.logo}
              square
              size={42}
            />
            <View className="min-w-0 flex-1 gap-1">
              <CustomText
                numberOfLines={2}
                className="font-sans-semibold text-sm"
              >
                {workspace.name}
              </CustomText>
              <CustomText className="text-xs text-ink-600">
                {disabled
                  ? "Workspace disabled"
                  : workspace.role === "OWNER"
                    ? "Owner"
                    : "Member"}
                {selected ? " · Current" : ""}
              </CustomText>
            </View>
            {switching ? (
              <CustomSpinner accessibilityLabel="Switching workspace" />
            ) : (
              selected && (
                <CustomIcon as={Check} size={19} className="text-brand-700" />
              )
            )}
          </Pressable>
        );
      })}
      {!items.length && state.status === "ready" && (
        <CustomText className="py-6 text-center text-sm text-ink-600">
          {query
            ? "No matching workspace."
            : "No workspaces are available for this account."}
        </CustomText>
      )}
      <CustomButton
        variant="ghost"
        fullWidth
        size="lg"
        disabled={!!state.switchingId || state.status === "loading"}
        leadingIcon={
          <CustomIcon as={RefreshCw} size={16} className="text-ink-700" />
        }
        onPress={() => void dispatch(loadWorkspaces(true))}
      >
        Refresh workspaces
      </CustomButton>
    </View>
  );
}
