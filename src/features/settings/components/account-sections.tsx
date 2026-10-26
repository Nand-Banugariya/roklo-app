import {
  Check,
  CircleCheck,
  LockKeyhole,
  Monitor,
  ShieldCheck,
  Smartphone,
} from "lucide-react-native";
import { useState } from "react";
import { Platform, View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { SettingsSelect } from "./settings-select";
import { SettingsInlineForm } from "./settings-inline-form";
import { CustomSwitch } from "@/components/shadcn-custom/customswitch";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { AppearanceControls } from "@/features/navigation/components/appearance-controls";
import { useAppShell } from "@/features/navigation/providers/app-shell-context";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { SettingsImagePicker } from "./settings-image-picker";
import {
  PreviewNote,
  SettingsDescription,
  SettingsRow,
  SettingsSection,
} from "./settings-section";

export function ProfileSection({
  user,
  workspace,
}: {
  user: AuthUser | null;
  workspace: Workspace | null;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [displayName, setDisplayName] = useState("");
  const [dialog, setDialog] = useState<"email" | "transfer" | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const dirty = name !== (user?.name ?? "") || !!displayName;
  return (
    <>
      {!dialog && <>
      <SettingsSection
        title="Profile"
        description="Your teammates see this name and photo on chats you own."
      >
        <SettingsImagePicker
          name={name || user?.mobileNumber}
          src={user?.image}
        />
        <View className="gap-4 sm:flex-row">
          <CustomFormField
            id="settings-profile-name"
            label="Full name"
            required
            className="min-w-0 sm:flex-1"
          >
            {(control) => (
              <CustomInput
                {...control}
                size="xl"
                value={name}
                onChangeText={setName}
                maxLength={100}
                placeholder="e.g. Priya Sharma"
                autoComplete="name"
                className="dark:text-white"
              />
            )}
          </CustomFormField>
          <CustomFormField
            id="settings-display-name"
            label="Display name in chats"
            help="Customers see this on messages you send. Leave empty to use your full name."
            className="min-w-0 sm:flex-1"
          >
            {(control) => (
              <CustomInput
                {...control}
                size="xl"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={100}
                placeholder={name.trim().split(/\s+/)[0] || "e.g. Priya"}
                className="dark:text-white"
              />
            )}
          </CustomFormField>
        </View>
        <View className="gap-4 sm:flex-row">
          <CustomFormField
            id="settings-profile-email"
            label="Email"
            help="Used to log in and for alert emails."
            className="min-w-0 sm:flex-1"
          >
            <View className="gap-2">
              <CustomInput
                accessibilityLabel="Email"
                size="xl"
                value={user?.email ?? ""}
                editable={false}
                placeholder="No email added"
                className="dark:text-white"
              />
              <View className="flex-row flex-wrap items-center gap-2">
                {!!user?.email && (
                  <View className="flex-row items-center gap-1 rounded-full bg-success-bg px-2 py-1">
                    <CustomIcon
                      as={user.isEmailVerified ? CircleCheck : LockKeyhole}
                      size={12}
                      className="text-brand-700"
                    />
                    <CustomText className="text-xs text-brand-800">
                      {user.isEmailVerified ? "Verified" : "Unverified"}
                    </CustomText>
                  </View>
                )}
                <CustomButton
                  variant="secondary"
                  size="lg"
                  onPress={() => setDialog("email")}
                >
                  {!user?.email
                    ? "Add email"
                    : user.isEmailVerified
                      ? "Change email"
                      : "Verify email"}
                </CustomButton>
              </View>
            </View>
          </CustomFormField>
          <CustomFormField
            id="settings-profile-mobile"
            label="Mobile"
            help="You sign in with a code sent to this number."
            className="min-w-0 sm:flex-1"
          >
            {(control) => (
              <CustomInput
                {...control}
                size="xl"
                editable={false}
                value={
                  user?.mobileNumber
                    ? `+${user.mobileNumber.replace(/^\+/, "")}`
                    : ""
                }
                className="font-mono dark:text-white"
              />
            )}
          </CustomFormField>
        </View>
        <View className="gap-3 border-t border-ink-150 pt-4">
          <View className="flex-row flex-wrap justify-end gap-2">
            <CustomButton
              variant="ghost"
              size="xl"
              disabled={!dirty}
              onPress={() => {
                setName(user?.name ?? "");
                setDisplayName("");
              }}
            >
              Discard
            </CustomButton>
            <CustomButton
              size="xl"
              disabled
              leadingIcon={
                <CustomIcon
                  as={Check}
                  size={16}
                  className="text-primary-foreground"
                />
              }
            >
              Save changes
            </CustomButton>
          </View>
          <PreviewNote />
        </View>
      </SettingsSection>
      {workspace?.role === "OWNER" && (
        <SettingsSection
          title="Transfer ownership"
          description={`Make a teammate the owner of ${workspace.name}. You'll become an agent.`}
          danger
        >
          <CustomButton
            variant="destructive"
            size="xl"
            className="self-start"
            onPress={() => setDialog("transfer")}
          >
            Transfer
          </CustomButton>
        </SettingsSection>
      )}
      </>}
      {dialog && (
        <SettingsInlineForm
          open
          onClose={() => setDialog(null)}
          title={dialog === "email" ? "Change email" : "Transfer ownership"}
          description={
            dialog === "email"
              ? "Add an email address for sign-in and alerts."
              : "Choose a teammate to become the workspace owner."
          }
        >
          <View className="gap-5">
            {dialog === "email" ? (
              <CustomFormField id="settings-new-email" label="Email address">
                {(control) => (
                  <CustomInput
                    {...control}
                    size="xl"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="you@company.com"
                  />
                )}
              </CustomFormField>
            ) : (
              <SettingsSelect
                value=""
                options={[]}
                onValueChange={() => undefined}
                placeholder="Choose a teammate"
                accessibilityLabel="New workspace owner"
                searchPlaceholder="Search teammates"
                emptyMessage="Teammates will appear here."
              />
            )}
            <PreviewNote />
            <CustomButton size="xl" disabled>
              {dialog === "email"
                ? "Send verification code"
                : "Transfer ownership"}
            </CustomButton>
            <CustomButton
              variant="secondary"
              size="xl"
              onPress={() => setDialog(null)}
            >
              Cancel
            </CustomButton>
          </View>
        </SettingsInlineForm>
      )}
    </>
  );
}

const PREFERENCE_ROWS = [
  {
    key: "sound",
    title: "Sound for new messages",
    description: "Play a sound when a customer replies.",
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Show notifications when Roklo is in the background.",
  },
  {
    key: "enter",
    title: "Press Enter to send",
    description: "Off: Enter adds a new line, Ctrl + Enter sends.",
  },
] as const;

export function PreferencesSection() {
  const { setColorScheme } = useRokloTheme();
  const [preferences, setPreferences] = useState({
    sound: false,
    notifications: false,
    enter: false,
  });
  return (
    <SettingsSection
      title="Preferences"
      description="Make Roklo feel right for you."
    >
      <SettingsRow
        title="Theme"
        description="Light, dark, or match your device's setting."
      >
        <View className="gap-1 sm:w-[240px]">
          <AppearanceControls />
          <CustomButton variant="link" onPress={() => setColorScheme("system")}>
            Use device setting
          </CustomButton>
        </View>
      </SettingsRow>
      <CustomFormField
        id="settings-language"
        label="Language"
        className="sm:max-w-[300px]"
      >
        <SettingsSelect
          value="en-IN"
          options={[{ value: "en-IN", label: "English (India)" }]}
          onValueChange={() => undefined}
          placeholder="Language"
          accessibilityLabel="Language"
          searchPlaceholder="Search languages"
          emptyMessage="No matching language"
        />
      </CustomFormField>
      {PREFERENCE_ROWS.map((row) => (
        <SettingsRow
          key={row.key}
          title={row.title}
          description={row.description}
          divided
          inline
        >
          <CustomSwitch
            accessibilityLabel={row.title}
            checked={preferences[row.key]}
            onCheckedChange={(checked) =>
              setPreferences((previous) => ({
                ...previous,
                [row.key]: checked,
              }))
            }
          />
        </SettingsRow>
      ))}
      <PreviewNote />
    </SettingsSection>
  );
}

export function SecuritySection() {
  const { openPanel } = useAppShell();
  return (
    <SettingsSection
      title="Security"
      description="You log in with a one-time code sent to your phone."
    >
      <View className="flex-row items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <CustomIcon as={ShieldCheck} size={24} className="text-brand-700" />
        <View className="flex-1 gap-1">
          <CustomText className="font-sans-medium text-sm dark:text-white">
            Password-free sign-in
          </CustomText>
          <SettingsDescription>
            Your phone number keeps your account connected to you.
          </SettingsDescription>
        </View>
      </View>
      <SettingsRow
        title="Active sessions"
        description="Manage the devices signed in to your account."
      >
        <CustomButton variant="link" disabled>
          Log out other sessions
        </CustomButton>
      </SettingsRow>
      <View className="flex-row items-center gap-3 rounded-xl border border-ink-200 p-4">
        <CustomIcon
          as={Platform.OS === "web" ? Monitor : Smartphone}
          size={21}
          className="text-ink-600"
        />
        <View className="flex-1 gap-1">
          <CustomText className="font-sans-medium text-sm dark:text-white">
            Current sign-in
          </CustomText>
          <SettingsDescription>
            You are using Roklo on this device.
          </SettingsDescription>
        </View>
        <View className="rounded-full bg-success-bg px-2 py-1">
          <CustomText className="text-xs text-success-fg">
            This device
          </CustomText>
        </View>
      </View>
      <CustomButton
        variant="secondary"
        size="xl"
        className="self-start"
        onPress={() => openPanel("logout")}
      >
        Sign out of this device
      </CustomButton>
      <PreviewNote />
    </SettingsSection>
  );
}
