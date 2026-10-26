import {
  Clock,
  Plus,
  Search,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { SettingsSelect } from "./settings-select";
import { SettingsInlineForm } from "./settings-inline-form";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { cn } from "@/lib/utils";
import { PreviewNote, SettingsSection } from "./settings-section";

export function TeamSection({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<"members" | "teams">("members");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"invite" | "team" | null>(null);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [teamName, setTeamName] = useState("");
  const close = () => setDialog(null);
  function open(next: "invite" | "team") {
    setPhone("");
    setRole("MEMBER");
    setTeamName("");
    setDialog(next);
  }
  return (
    <>
      {!dialog && <>
      <View className="flex-row flex-wrap gap-3">
        {[
          { label: "Members", icon: Users },
          { label: "Teams", icon: UsersRound },
          { label: "Pending invites", icon: Clock },
        ].map(({ label, icon }) => (
          <View
            key={label}
            className="min-w-[120px] flex-1 gap-3 rounded-xl border border-ink-200 bg-card p-4"
          >
            <View className="flex-row items-center gap-2">
              <CustomIcon as={icon} size={17} className="text-brand-700" />
              <CustomText className="text-xs text-ink-600 dark:text-white">
                {label}
              </CustomText>
            </View>
            <CustomText className="font-sans-semibold text-2xl dark:text-white">
              —
            </CustomText>
          </View>
        ))}
      </View>
      <SettingsSection
        title="Your team"
        description="Manage teammates, roles and the teams they work in."
        action={
          canManage ? (
            <CustomButton
              variant="secondary"
              size="xl"
              onPress={() => open("invite")}
              leadingIcon={
                <CustomIcon as={UserPlus} size={17} className="text-ink-700" />
              }
            >
              Invite teammate
            </CustomButton>
          ) : undefined
        }
      >
        <View
          className="flex-row gap-2 border-b border-ink-200 pb-3"
          role="tablist"
          accessibilityLabel="Team views"
        >
          {(["members", "teams"] as const).map((item) => (
            <Pressable
              key={item}
              role="tab"
              accessibilityLabel={item === "members" ? "Members" : "Teams"}
              aria-selected={tab === item}
              accessibilityState={{ selected: tab === item }}
              onPress={() => {
                setTab(item);
                setQuery("");
              }}
              className={cn(
                "min-h-11 flex-1 items-center justify-center rounded-lg px-4",
                tab === item && "bg-brand-50",
              )}
            >
              <CustomText
                className={cn(
                  "text-sm dark:text-white",
                  tab === item && "font-sans-semibold text-brand-800",
                )}
              >
                {item === "members" ? "Members" : "Teams"}
              </CustomText>
            </Pressable>
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          <CustomIcon as={Search} size={18} className="text-ink-500" />
          <CustomInput
            size="xl"
            className="flex-1 dark:text-white"
            value={query}
            onChangeText={setQuery}
            placeholder={
              tab === "members" ? "Search teammates" : "Search teams"
            }
            accessibilityLabel={
              tab === "members" ? "Search teammates" : "Search teams"
            }
          />
        </View>
        <View className="items-center gap-3 rounded-xl border border-dashed border-ink-250 px-5 py-9">
          <CustomIcon
            as={tab === "members" ? Users : UsersRound}
            size={32}
            className="text-brand-700"
          />
          <CustomText className="text-center font-sans-semibold text-base dark:text-white">
            {tab === "members"
              ? "A shared space for your team"
              : "Bring the right people together"}
          </CustomText>
          <CustomText className="max-w-[300px] text-center text-[13px] leading-5 text-ink-600 dark:text-white">
            {tab === "members"
              ? "Teammates, roles and pending invitations will appear here."
              : "Organize teammates into teams for shared conversations."}
          </CustomText>
          {canManage && (
            <CustomButton
              size="xl"
              onPress={() => open(tab === "members" ? "invite" : "team")}
              leadingIcon={
                <CustomIcon
                  as={Plus}
                  size={17}
                  className="text-primary-foreground"
                />
              }
            >
              {tab === "members" ? "Invite teammate" : "Create team"}
            </CustomButton>
          )}
        </View>
      </SettingsSection>
      </>}
      {dialog && (
        <SettingsInlineForm
          open
          onClose={close}
          title={dialog === "invite" ? "Invite teammate" : "Create team"}
          description={
            dialog === "invite"
              ? "Invite someone to your workspace using their WhatsApp number."
              : "Give teammates a shared space to work together."
          }
        >
          <View className="gap-5">
            {dialog === "invite" ? (
              <>
                <CustomFormField
                  id="settings-invite-phone"
                  label="WhatsApp number"
                  required
                >
                  {(control) => (
                    <CustomInput
                      {...control}
                      size="xl"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+91 98765 43210"
                    />
                  )}
                </CustomFormField>
                <CustomFormField id="settings-invite-role" label="Role">
                  <SettingsSelect
                    value={role}
                    onValueChange={setRole}
                    options={[
                      { value: "MEMBER", label: "Agent" },
                      { value: "ADMIN", label: "Admin" },
                    ]}
                    placeholder="Choose role"
                    accessibilityLabel="Invitation role"
                    searchPlaceholder="Search roles"
                    emptyMessage="No matching role"
                  />
                </CustomFormField>
              </>
            ) : (
              <CustomFormField
                id="settings-team-name"
                label="Team name"
                required
              >
                {(control) => (
                  <CustomInput
                    {...control}
                    size="xl"
                    maxLength={100}
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="e.g. Customer support"
                  />
                )}
              </CustomFormField>
            )}
            <PreviewNote />
            <CustomButton size="xl" disabled>
              {dialog === "invite" ? "Send invitation" : "Create team"}
            </CustomButton>
            <CustomButton variant="secondary" size="xl" onPress={close}>
              Cancel
            </CustomButton>
          </View>
        </SettingsInlineForm>
      )}
    </>
  );
}
