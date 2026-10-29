import { Check, UsersRound } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import type { AccessTarget } from "@/features/messaging/types";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadAccessTargets } from "../services/broadcasts-service";
import { selectAccessTargets } from "../store/broadcasts-selectors";

export interface AccessValue {
  teamIds: string[];
  memberIds: string[];
}

/**
 * "Teams and people" for a TEAM broadcast, as the web's access picker: the workspace's teams and its active
 * members, each with a tick. Inline, as the WhatsApp number's visibility form does it.
 */
export function AccessPicker({
  value,
  onChange,
}: {
  value: AccessValue;
  onChange: (next: AccessValue) => void;
}) {
  const dispatch = useAppDispatch();
  // Teams and active members, in the `broadcasts` slice (re-read each time the picker shows).
  const targets = useAppSelector(selectAccessTargets);
  useEffect(() => {
    void dispatch(loadAccessTargets());
  }, [dispatch]);
  const toggle = (key: keyof AccessValue, id: string) =>
    onChange({
      ...value,
      [key]: value[key].includes(id)
        ? value[key].filter((other) => other !== id)
        : [...value[key], id],
    });

  if (targets.status === "error")
    return <CustomText className="text-[13px] text-error-fg">{targets.error}</CustomText>;
  if (targets.status !== "ready")
    return (
      <View className="items-start py-2">
        <CustomSpinner size="small" accessibilityLabel="Loading teams and people" />
      </View>
    );
  return (
    <View className="gap-4">
      <List
        title="Teams"
        empty="No teams in this workspace yet."
        items={targets.teams}
        selected={value.teamIds}
        team
        onToggle={(id) => toggle("teamIds", id)}
      />
      <List
        title="People"
        empty="No other active members."
        items={targets.members}
        selected={value.memberIds}
        onToggle={(id) => toggle("memberIds", id)}
      />
    </View>
  );
}

function List({
  title,
  empty,
  items,
  selected,
  team,
  onToggle,
}: {
  title: string;
  empty: string;
  items: AccessTarget[];
  selected: string[];
  team?: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors } = useRokloTheme();
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
      {items.length === 0 ? (
        <CustomText className="text-[13px] text-muted-foreground">{empty}</CustomText>
      ) : (
        <View className="overflow-hidden rounded-xl border border-border">
          {items.map((item, index) => {
            const on = selected.includes(item.id);
            // Fixed classes; first and picked go on as a style (a pressable's classes mustn't gain new kinds of style).
            return (
              <MotionPressable
                key={item.id}
                role="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.name}
                onPress={() => onToggle(item.id)}
                className="min-h-12 flex-row items-center gap-3 border-t border-border bg-card px-3 py-2 active:bg-accent"
                style={{
                  borderTopWidth: index === 0 ? 0 : 1,
                  ...(on && { backgroundColor: colors["brand-50"] }),
                }}
              >
                {team ? (
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-info-bg">
                    <CustomIcon as={UsersRound} size={15} className="text-info-fg" />
                  </View>
                ) : (
                  <CustomAvatar name={item.name} size={32} />
                )}
                <View className="min-w-0 flex-1">
                  <CustomText numberOfLines={1} className="font-sans-medium text-sm">
                    {item.name}
                  </CustomText>
                </View>
                <View
                  className={cn(
                    "h-5 w-5 items-center justify-center rounded-full border-2",
                    on ? "border-primary bg-primary" : "border-ink-300",
                  )}
                >
                  {on && (
                    <CustomIcon
                      as={Check}
                      size={11}
                      strokeWidth={3}
                      className="text-primary-foreground"
                    />
                  )}
                </View>
              </MotionPressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
