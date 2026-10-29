import { Check, Globe, Lock, ShieldCheck, Users, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { useSmoothMotion } from "../hooks/use-smooth-motion";
import { useMessaging } from "../providers/messaging-provider";
import type { AccessTarget, NumberVisibility, WhatsAppNumber } from "../types";

const OPTIONS: { value: NumberVisibility; icon: LucideIcon }[] = [
  { value: "EVERYONE", icon: Globe },
  { value: "TEAM", icon: Users },
  { value: "ME_ONLY", icon: Lock },
];
function optionText(value: NumberVisibility, isOwner: boolean) {
  if (value === "EVERYONE")
    return { label: "Everyone", hint: "Everyone in the workspace sees its chats" };
  if (value === "TEAM")
    return { label: "Teams and people", hint: "Only the teams and people you pick" };
  return isOwner
    ? { label: "Only me", hint: "Only you see its chats" }
    : { label: "Only its owner", hint: "Only whoever added it sees its chats" };
}
const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

/** Who sees a number's chats, inside its card. TEAM replaces its grants with the teams and people picked here. */
export function VisibilityForm({
  number,
  isOwner,
  onDone,
}: {
  number: WhatsAppNumber;
  isOwner: boolean;
  onDone: () => void;
}) {
  const { api, refreshNumbers } = useMessaging();
  const current = number.visibility ?? "EVERYONE";
  const [saved] = useState(() => ({
    teamIds: (number.accessGrants ?? []).flatMap((grant) => (grant.team ? [grant.team.id] : [])),
    memberIds: (number.accessGrants ?? []).flatMap((grant) =>
      !grant.team && grant.user ? [grant.user.id] : [],
    ),
  }));
  const [visibility, setVisibility] = useState<NumberVisibility>(current);
  const [teamIds, setTeamIds] = useState(saved.teamIds);
  const [memberIds, setMemberIds] = useState(saved.memberIds);
  const [targets, setTargets] = useState<{ teams: AccessTarget[]; members: AccessTarget[] } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const pickingTargets = visibility === "TEAM";
  const motion = useSmoothMotion();

  useEffect(() => {
    if (!pickingTargets || targets) return;
    const controller = new AbortController();
    void Promise.all([api.teams(controller.signal), api.members(controller.signal)]).then(
      ([teams, members]) => {
        if (controller.signal.aborted) return;
        if (!teams.ok || !members.ok) {
          setLoadError(
            (!teams.ok ? teams.message : !members.ok ? members.message : "") ||
              "Couldn't load teams and people.",
          );
          return;
        }
        setTargets({
          teams: teams.data.map((team) => ({
            id: team.id,
            name: team.name,
            detail:
              team._count?.members != null
                ? `${team._count.members} ${team._count.members === 1 ? "member" : "members"}`
                : undefined,
          })),
          // The API rejects grants to pending or disabled members.
          members: members.data
            .flatMap((member) =>
              member.status === "ENABLED" && member.user
                ? [
                    {
                      id: member.user.id,
                      name: member.user.name?.trim() || member.user.email || "Unnamed",
                      detail: member.user.email || undefined,
                    },
                  ]
                : [],
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        });
      },
    );
    return () => controller.abort();
  }, [api, pickingTargets, targets]);

  const picked = teamIds.length + memberIds.length;
  const noTargets = pickingTargets && picked === 0;
  const unchanged =
    visibility === current &&
    (!pickingTargets || (sameIds(teamIds, saved.teamIds) && sameIds(memberIds, saved.memberIds)));
  async function save() {
    setSubmitted(true);
    if (noTargets || busy) return;
    if (unchanged) {
      onDone();
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api.setVisibility(number.id, visibility, { teamIds, memberIds });
    if (!result.ok) {
      setBusy(false);
      setError(result.message || "Couldn't change who sees this number. Try again.");
      return;
    }
    await refreshNumbers();
    onDone();
  }

  return (
    <View className="gap-4">
      <View className="gap-0.5">
        <CustomText className="font-sans-semibold text-[15px]">Who can see these chats?</CustomText>
        <CustomText className="text-xs leading-4 text-muted-foreground">
          Pick who in your workspace can read and reply to them.
        </CustomText>
      </View>

      <View accessibilityRole="radiogroup" className="gap-2">
        {OPTIONS.map(({ value, icon }) => {
          const text = optionText(value, isOwner);
          const selected = visibility === value;
          return (
            <MotionPressable
              key={value}
              role="radio"
              accessibilityState={{ checked: selected, disabled: busy }}
              accessibilityLabel={`${text.label}. ${text.hint}`}
              disabled={busy}
              onPress={() => {
                setVisibility(value);
                setError(null);
              }}
              className={cn(
                "flex-row items-center gap-3 rounded-xl border p-3 active:opacity-90",
                selected ? "border-primary bg-brand-50" : "border-border bg-card",
              )}
            >
              <View
                className={cn(
                  "h-9 w-9 items-center justify-center rounded-lg",
                  selected ? "bg-primary" : "bg-muted",
                )}
              >
                <CustomIcon
                  as={icon}
                  size={17}
                  className={selected ? "text-primary-foreground" : "text-muted-foreground"}
                />
              </View>
              <View className="min-w-0 flex-1">
                <CustomText className="font-sans-semibold text-sm">{text.label}</CustomText>
                <CustomText className="text-xs leading-4 text-muted-foreground">
                  {text.hint}
                </CustomText>
              </View>
              <Tick checked={selected} />
            </MotionPressable>
          );
        })}
      </View>

      {pickingTargets &&
        (loadError ? (
          <CustomText className="text-xs text-error-fg">{loadError}</CustomText>
        ) : !targets ? (
          <View className="items-center py-3">
            <CustomSpinner accessibilityLabel="Loading teams and people" />
          </View>
        ) : (
          <Animated.View {...motion.panel}>
            <View className="gap-4">
              <TargetList
                title="Teams"
                empty="No teams in this workspace yet."
                items={targets.teams}
                selected={teamIds}
                disabled={busy}
                onToggle={(id) => {
                  setTeamIds((ids) => toggle(ids, id));
                  setError(null);
                }}
              />
              <TargetList
                title="People"
                empty="No other active members."
                items={targets.members}
                selected={memberIds}
                disabled={busy}
                onToggle={(id) => {
                  setMemberIds((ids) => toggle(ids, id));
                  setError(null);
                }}
              />
            </View>
          </Animated.View>
        ))}

      <View className="flex-row items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
        <CustomIcon as={ShieldCheck} size={14} className="text-muted-foreground" />
        <CustomText className="flex-1 text-[11px] leading-4 text-muted-foreground">
          Workspace owners and admins can always see these chats.
        </CustomText>
      </View>

      {submitted && noTargets && (
        <CustomText className="text-xs text-error-fg">Pick at least one team or person.</CustomText>
      )}
      {error && <CustomText className="text-xs text-error-fg">{error}</CustomText>}
      <View className="flex-row gap-2">
        <CustomButton
          className="flex-1"
          loading={busy}
          disabled={unchanged || (pickingTargets && !targets)}
          onPress={() => void save()}
        >
          {pickingTargets && picked ? `Save · ${picked} selected` : "Save"}
        </CustomButton>
        <CustomButton variant="outline" disabled={busy} onPress={onDone}>
          Cancel
        </CustomButton>
      </View>
    </View>
  );
}

function Tick({ checked }: { checked: boolean }) {
  return (
    <View
      className={cn(
        "h-5 w-5 items-center justify-center rounded-full border-2",
        checked ? "border-primary bg-primary" : "border-border",
      )}
    >
      {checked && (
        <CustomIcon as={Check} size={11} strokeWidth={3} className="text-primary-foreground" />
      )}
    </View>
  );
}

function TargetList({
  title,
  empty,
  items,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  empty: string;
  items: AccessTarget[];
  selected: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  const count = items.filter((item) => selected.includes(item.id)).length;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between px-0.5">
        <CustomText className="font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
          {title.toUpperCase()}
        </CustomText>
        {count > 0 && (
          <CustomText className="font-sans-medium text-[11px] text-primary">
            {count} selected
          </CustomText>
        )}
      </View>
      {items.length ? (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item, index) => {
            const checked = selected.includes(item.id);
            return (
              <MotionPressable
                key={item.id}
                role="checkbox"
                accessibilityState={{ checked, disabled }}
                accessibilityLabel={item.name}
                disabled={disabled}
                onPress={() => onToggle(item.id)}
                className={cn(
                  "min-h-12 flex-row items-center gap-3 px-3 py-2 active:bg-accent",
                  index > 0 && "border-t border-border",
                )}
              >
                <View
                  className={cn(
                    "h-8 w-8 items-center justify-center rounded-full",
                    checked ? "bg-brand-100" : "bg-muted",
                  )}
                >
                  <CustomText
                    className={cn(
                      "font-sans-semibold text-[11px]",
                      checked ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {initials(item.name)}
                  </CustomText>
                </View>
                <View className="min-w-0 flex-1">
                  <CustomText numberOfLines={1} className="font-sans-medium text-sm">
                    {item.name}
                  </CustomText>
                  {!!item.detail && (
                    <CustomText numberOfLines={1} className="text-xs text-muted-foreground">
                      {item.detail}
                    </CustomText>
                  )}
                </View>
                <Tick checked={checked} />
              </MotionPressable>
            );
          })}
        </View>
      ) : (
        <CustomText className="px-0.5 text-xs text-muted-foreground">{empty}</CustomText>
      )}
    </View>
  );
}
