import { router } from "expo-router";
import { Bell, Gem, Plus, Smartphone, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { SettingsSelect } from "./settings-select";
import { SettingsInlineForm } from "./settings-inline-form";
import { CustomSwitch } from "@/components/shadcn-custom/customswitch";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useAppShell } from "@/features/navigation/providers/app-shell-context";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { SettingsImagePicker } from "./settings-image-picker";
import { PreviewNote, SettingsDescription, SettingsRow, SettingsSection } from "./settings-section";

const TIME_ZONES = [
  { value: "Asia/Kolkata", label: "(UTC+05:30) India Standard Time" },
  { value: "UTC", label: "(UTC+00:00) Coordinated Universal Time" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Dubai" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Singapore" },
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
];

export function GeneralSection({ workspace }: { workspace: Workspace | null }) {
  const { openPanel } = useAppShell();
  const [name, setName] = useState(workspace?.name ?? "");
  const [timeZone, setTimeZone] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return (
    <>
      {!deleting && (
        <>
          <View className="flex-row items-center gap-3 rounded-xl border border-ink-200 bg-card p-5">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
              <CustomIcon as={Gem} size={21} className="text-brand-700" />
            </View>
            <View className="flex-1 gap-1">
              <SettingsDescription>Current plan</SettingsDescription>
              <CustomText className="font-sans-semibold text-[15px] dark:text-white">—</CustomText>
            </View>
          </View>
          <SettingsSection
            title="General"
            description={
              workspace
                ? `Applies to everyone in ${workspace.name}.`
                : "Your workspace details and preferences."
            }
          >
            <SettingsImagePicker
              name={workspace?.name ?? "Workspace"}
              src={workspace?.logo}
              square
              maxMB={5}
            />
            <View className="gap-3">
              <CustomFormField
                id="settings-workspace-name"
                label="Workspace name"
                required
                help="Shown to your team and on invites."
              >
                {(control) => (
                  <CustomInput
                    {...control}
                    size="xl"
                    maxLength={100}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Acme Corp"
                    autoComplete="organization"
                    className="dark:text-white"
                  />
                )}
              </CustomFormField>
              <View className="flex-row flex-wrap gap-2">
                <CustomButton size="xl" disabled>
                  Save
                </CustomButton>
                <CustomButton
                  variant="ghost"
                  size="xl"
                  disabled={name === (workspace?.name ?? "")}
                  onPress={() => setName(workspace?.name ?? "")}
                >
                  Discard
                </CustomButton>
              </View>
            </View>
            <SettingsRow
              divided
              title="Time zone"
              description="Used for scheduled broadcasts, reply-time reports and alert timings."
            >
              <View className="sm:w-[280px]">
                <SettingsSelect
                  value={timeZone}
                  onValueChange={setTimeZone}
                  options={TIME_ZONES}
                  placeholder="Select time zone"
                  accessibilityLabel="Time zone"
                  searchPlaceholder="Search time zones"
                  emptyMessage="No matching time zone"
                />
              </View>
            </SettingsRow>
            {!workspace && (
              <CustomButton variant="secondary" size="xl" onPress={() => openPanel("workspaces")}>
                Choose a workspace
              </CustomButton>
            )}
            <PreviewNote />
          </SettingsSection>
          {workspace?.role === "OWNER" && (
            <SettingsSection
              title="Danger zone"
              description={`These actions affect everyone in ${workspace.name}.`}
              danger
            >
              <SettingsRow
                title="Delete workspace"
                description="Permanently deletes all chats, contacts, groups, templates and broadcast history. All WhatsApp numbers are unlinked and teammates lose access."
                divided
              >
                <CustomButton
                  variant="destructive"
                  size="xl"
                  onPress={() => {
                    setConfirmation("");
                    setDeleting(true);
                  }}
                >
                  Delete workspace
                </CustomButton>
              </SettingsRow>
            </SettingsSection>
          )}
        </>
      )}
      {deleting && (
        <SettingsInlineForm
          open
          onClose={() => setDeleting(false)}
          title="Delete workspace?"
          description={`This permanently removes ${workspace?.name ?? "this workspace"} and its data.`}
        >
          <View className="gap-5">
            <CustomIcon as={Trash2} size={28} className="text-error-fg" />
            <CustomFormField id="settings-delete-name" label="Type the workspace name to confirm">
              {(control) => (
                <CustomInput
                  {...control}
                  size="xl"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  placeholder={workspace?.name}
                  autoCorrect={false}
                />
              )}
            </CustomFormField>
            <PreviewNote />
            <CustomButton variant="destructive-solid" size="xl" disabled>
              Delete permanently
            </CustomButton>
            <CustomButton variant="secondary" size="xl" onPress={() => setDeleting(false)}>
              Keep workspace
            </CustomButton>
          </View>
        </SettingsInlineForm>
      )}
    </>
  );
}

export function NumbersSection() {
  return (
    <SettingsSection
      title="WhatsApp numbers"
      description="Each number keeps its own chats and daily sending limit."
    >
      <View className="items-center gap-3 rounded-xl border border-dashed border-ink-250 px-5 py-9">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <CustomIcon as={Smartphone} size={26} className="text-brand-700" />
        </View>
        <CustomText className="text-center font-sans-semibold text-base dark:text-white">
          Your business numbers
        </CustomText>
        <CustomText className="max-w-[320px] text-center text-[13px] leading-5 text-ink-600 dark:text-white">
          Link your business WhatsApp to bring its chats into Roklo. Numbers and their connection
          status will appear here.
        </CustomText>
        <CustomButton
          size="xl"
          onPress={() => router.navigate("/connections")}
          leadingIcon={<CustomIcon as={Plus} size={17} className="text-primary-foreground" />}
        >
          Connect number
        </CustomButton>
      </View>
    </SettingsSection>
  );
}

const ALERT_ROWS = [
  {
    key: "disconnects",
    title: "WhatsApp disconnects",
    description: "When the linked phone logs out or loses connection.",
  },
  {
    key: "broadcastFailed",
    title: "Broadcast paused or failed",
    description: "When sending stops before finishing.",
  },
  {
    key: "chatWaiting",
    title: "Chat waiting too long",
    description: "When a customer waits more than 30 min for a reply.",
  },
] as const;

export function AlertsSection() {
  const [alerts, setAlerts] = useState({
    disconnects: false,
    broadcastFailed: false,
    chatWaiting: false,
  });
  return (
    <SettingsSection title="Alerts" description="Sent in-app and by email to owners and admins.">
      <View className="flex-row items-center gap-3 rounded-xl bg-brand-50 p-4">
        <CustomIcon as={Bell} size={21} className="text-brand-700" />
        <View className="flex-1">
          <SettingsDescription>
            Stay informed when your workspace needs attention.
          </SettingsDescription>
        </View>
      </View>
      {ALERT_ROWS.map((row) => (
        <SettingsRow key={row.key} title={row.title} description={row.description} divided inline>
          <CustomSwitch
            accessibilityLabel={row.title}
            checked={alerts[row.key]}
            onCheckedChange={(checked) =>
              setAlerts((previous) => ({ ...previous, [row.key]: checked }))
            }
          />
        </SettingsRow>
      ))}
      <PreviewNote />
    </SettingsSection>
  );
}
