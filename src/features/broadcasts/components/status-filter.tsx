import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { FILTERS, STATUS } from "../constants";
import type { BroadcastFilter, BroadcastTag } from "../types";
import { formatCount } from "../utils/broadcast-format";

const labelOf = (filter: BroadcastFilter) => FILTERS.find((item) => item.value === filter)!.label;
const sameTags = (a: string[], b: string[]) => [...a].sort().join(",") === [...b].sort().join(",");
/** A tag's own colour as a faint tint, or the neutral for one without a 6-digit colour. */
const tint = (color: string | null, fallback: string) =>
  color?.length === 7 ? `${color}24` : fallback;

export interface BroadcastFilters {
  status: BroadcastFilter;
  tagIds: string[];
}

/** The filter button beside the search bar: green, with a dot, while a status or tag is picked. */
export function FilterButton({
  active,
  open,
  onPress,
}: {
  active: boolean;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={active ? "Filters on. Change filters" : "Filter broadcasts"}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      className={cn(
        "h-12 w-12 items-center justify-center rounded-xl",
        active ? "bg-primary" : open ? "bg-muted" : "bg-accent",
      )}
    >
      <CustomIcon
        as={SlidersHorizontal}
        size={19}
        className={active ? "text-primary-foreground" : "text-foreground"}
      />
      {active && (
        <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border border-primary bg-primary-foreground" />
      )}
    </MotionPressable>
  );
}

/**
 * "Filter broadcasts", floating over the list under the search bar: a labelled dropdown per filter, Status
 * (one) and Tags (any of several, searchable), each opening its options in place. Nothing changes until Apply.
 */
export function FilterPanel({
  value,
  tags,
  tagsError,
  counts,
  onApply,
  onRetryTags,
}: {
  value: BroadcastFilters;
  /** The workspace's broadcast tags; null while they load. */
  tags: BroadcastTag[] | null;
  tagsError: string | null;
  /** How many broadcasts a status covers with the applied tags and search, or null when unknown. */
  counts: (filter: BroadcastFilter) => number | null;
  onApply: (next: BroadcastFilters) => void;
  onRetryTags: () => void;
}) {
  const reduced = useReducedMotion();
  const [status, setStatus] = useState(value.status);
  const [tagIds, setTagIds] = useState(value.tagIds);
  const [open, setOpen] = useState<"status" | "tags" | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const changed = status !== value.status || !sameTags(tagIds, value.tagIds);
  const empty = status === "ALL" && tagIds.length === 0;
  // Counts belong to the applied tags: shown only while the picked tags are still those.
  const countsFit = sameTags(tagIds, value.tagIds);
  const picked = (tags ?? []).filter((tag) => tagIds.includes(tag.id));
  const term = tagQuery.trim().toLowerCase();
  const matching = (tags ?? []).filter((tag) => !term || tag.name.toLowerCase().includes(term));
  const toggleTag = (id: string) =>
    setTagIds((old) => (old.includes(id) ? old.filter((other) => other !== id) : [...old, id]));
  const tagsLabel = !picked.length
    ? "Any tag"
    : picked.length === 1
      ? picked[0].name
      : `${picked[0].name} +${picked.length - 1}`;

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(200)}
      exiting={reduced ? undefined : FadeOut.duration(120)}
    >
      <View
        className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/20"
        style={{ elevation: 12 }}
      >
        <View className="gap-3 p-4">
          <CustomText role="heading" className="font-sans-semibold text-[15px]">
            Filter broadcasts
          </CustomText>

          <Field
            label="Status"
            value={status === "ALL" ? "Any status" : labelOf(status)}
            placeholder={status === "ALL"}
            open={open === "status"}
            onPress={() => setOpen((now) => (now === "status" ? null : "status"))}
          />
          {open === "status" && (
            <Options>
              {FILTERS.map((item, index) => {
                const count = countsFit ? counts(item.value) : null;
                return (
                  <Option
                    key={item.value}
                    first={index === 0}
                    role="radio"
                    checked={status === item.value}
                    label={item.value === "ALL" ? "Any status" : item.label}
                    leading={
                      item.value === "ALL" ? null : (
                        <View
                          className={cn(
                            "h-2 w-2 rounded-full",
                            STATUS[item.value as Exclude<BroadcastFilter, "ALL">].bar,
                          )}
                        />
                      )
                    }
                    trailing={count !== null ? formatCount(count) : null}
                    onPress={() => {
                      setStatus(item.value);
                      setOpen(null);
                    }}
                  />
                );
              })}
            </Options>
          )}

          <Field
            label="Tags"
            value={tagsLabel}
            placeholder={!picked.length}
            open={open === "tags"}
            onPress={() => setOpen((now) => (now === "tags" ? null : "tags"))}
          />
          {open === "tags" && (
            <Options>
              <View className="flex-row items-center gap-2 border-b border-border px-3">
                <CustomIcon as={Search} size={16} className="text-muted-foreground" />
                <CustomInput
                  value={tagQuery}
                  onChangeText={setTagQuery}
                  placeholder="Search tags"
                  accessibilityLabel="Search tags"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                  className="min-w-0 flex-1 border-0 bg-transparent px-1"
                />
              </View>
              {tagsError && !tags ? (
                <View className="gap-1 p-3">
                  <CustomText className="text-[13px] text-error-fg">{tagsError}</CustomText>
                  <CustomButton
                    variant="link"
                    size="sm"
                    className="self-start px-0"
                    onPress={onRetryTags}
                  >
                    Try again
                  </CustomButton>
                </View>
              ) : !tags ? (
                <View className="items-center py-4">
                  <CustomSpinner size="small" accessibilityLabel="Loading tags" />
                </View>
              ) : matching.length === 0 ? (
                <CustomText className="px-3 py-4 text-[13px] text-muted-foreground">
                  {tags.length
                    ? "No matching tags."
                    : "No broadcast tags yet. Add them when you create a broadcast."}
                </CustomText>
              ) : (
                // A long tag list scrolls inside the panel, so Apply stays on screen.
                <ScrollView
                  style={{ maxHeight: 220 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {matching.map((tag, index) => (
                    <Option
                      key={tag.id}
                      first={index === 0}
                      role="checkbox"
                      checked={tagIds.includes(tag.id)}
                      label={tag.name}
                      leading={<TagDot color={tag.color} />}
                      onPress={() => toggleTag(tag.id)}
                    />
                  ))}
                </ScrollView>
              )}
            </Options>
          )}
        </View>

        <View className="flex-row items-center justify-between gap-2 border-t border-border px-4 py-3">
          <CustomButton
            size="sm"
            variant="ghost"
            disabled={empty}
            onPress={() => {
              setStatus("ALL");
              setTagIds([]);
              setOpen(null);
            }}
          >
            Clear all
          </CustomButton>
          <CustomButton
            size="sm"
            className="px-5"
            disabled={!changed}
            onPress={() => onApply({ status, tagIds })}
          >
            Apply
          </CustomButton>
        </View>
      </View>
    </Animated.View>
  );
}

/** One filter: its label on the left and the picked value as a dropdown field on the right. */
function Field({
  label,
  value,
  placeholder,
  open,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const { colors } = useRokloTheme();
  return (
    <View className="flex-row items-center gap-3">
      <CustomText className="w-14 text-sm text-muted-foreground">{label}</CustomText>
      {/* Fixed classes; the open border and arrow go on as a style (a pressable's classes mustn't gain new kinds of style). */}
      <MotionPressable
        role="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        className="h-11 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl border bg-background px-3 active:bg-accent"
        style={{ borderColor: open ? colors.primary : colors.input }}
      >
        <CustomText
          numberOfLines={1}
          className={cn(
            "min-w-0 flex-1 text-sm",
            placeholder ? "text-muted-foreground" : "font-sans-medium text-foreground",
          )}
        >
          {value}
        </CustomText>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <CustomIcon as={ChevronDown} size={17} className="text-muted-foreground" />
        </View>
      </MotionPressable>
    </View>
  );
}

function Options({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-background">
      {children}
    </View>
  );
}

/** A row of a dropdown: a box (several) or a tick (one), its dot and name, and a count. */
function Option({
  first,
  role,
  checked,
  label,
  leading,
  trailing,
  onPress,
}: {
  first: boolean;
  role: "radio" | "checkbox";
  checked: boolean;
  label: string;
  leading?: ReactNode;
  trailing?: string | null;
  onPress: () => void;
}) {
  const { colors } = useRokloTheme();
  return (
    <MotionPressable
      role={role}
      accessibilityState={{ checked }}
      accessibilityLabel={`${label}${trailing ? `, ${trailing}` : ""}`}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-2.5 border-t border-border px-3 py-2 active:bg-accent"
      style={{
        borderTopWidth: first ? 0 : 1,
        ...(checked && { backgroundColor: colors["brand-50"] }),
      }}
    >
      {role === "checkbox" && (
        <View
          className={cn(
            "h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2",
            checked ? "border-primary bg-primary" : "border-ink-300",
          )}
        >
          {checked && (
            <CustomIcon
              as={Check}
              size={11}
              strokeWidth={3.2}
              className="text-primary-foreground"
            />
          )}
        </View>
      )}
      {leading}
      <CustomText
        numberOfLines={1}
        className={cn(
          "min-w-0 flex-1 text-sm",
          checked ? "font-sans-semibold text-foreground" : "text-ink-700",
        )}
      >
        {label}
      </CustomText>
      {!!trailing && (
        <CustomText className="font-sans-medium text-xs text-muted-foreground">
          {trailing}
        </CustomText>
      )}
      {role === "radio" && checked && (
        <CustomIcon as={Check} size={16} strokeWidth={2.6} className="text-primary" />
      )}
    </MotionPressable>
  );
}

function TagDot({ color }: { color: string | null }) {
  const { colors } = useRokloTheme();
  return (
    <View
      className="h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color?.length === 7 ? color : colors["ink-400"] }}
    />
  );
}

/**
 * While filters are on: a chip for the status and one per tag, each with × to drop it, and "Clear" for all.
 * `count` is how many broadcasts match.
 */
export function ActiveFilters({
  value,
  tags,
  count,
  onChange,
}: {
  value: BroadcastFilters;
  tags: BroadcastTag[] | null;
  count: number | null;
  onChange: (next: BroadcastFilters) => void;
}) {
  const reduced = useReducedMotion();
  const { colors } = useRokloTheme();
  const picked = value.tagIds.map(
    (id) => (tags ?? []).find((tag) => tag.id === id) ?? { id, name: "Tag", color: null },
  );
  if (value.status === "ALL" && !picked.length) return null;
  const look = value.status === "ALL" ? null : STATUS[value.status];
  // Classes on the plain view inside: Reanimated never receives NativeWind class names.
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(160)}>
      <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
        {look && (
          <Chip
            label={`${labelOf(value.status)}${count !== null && !picked.length ? ` · ${formatCount(count)}` : ""}`}
            className={look.pill}
            textClass={look.text}
            onRemove={() => onChange({ ...value, status: "ALL" })}
          />
        )}
        {picked.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            style={{ backgroundColor: tint(tag.color, colors.accent) }}
            leading={<TagDot color={tag.color} />}
            onRemove={() =>
              onChange({ ...value, tagIds: value.tagIds.filter((id) => id !== tag.id) })
            }
          />
        ))}
        {(look ? 1 : 0) + picked.length > 1 && (
          <MotionPressable
            role="button"
            accessibilityLabel="Clear all filters"
            onPress={() => onChange({ status: "ALL", tagIds: [] })}
            hitSlop={6}
            className="h-8 justify-center px-1.5"
          >
            <CustomText className="font-sans-semibold text-[13px] text-primary">Clear</CustomText>
          </MotionPressable>
        )}
      </View>
    </Animated.View>
  );
}

function Chip({
  label,
  className,
  textClass = "text-foreground",
  style,
  leading,
  onRemove,
}: {
  label: string;
  className?: string;
  textClass?: string;
  style?: { backgroundColor: string };
  leading?: ReactNode;
  onRemove: () => void;
}) {
  return (
    <View
      className={cn(
        "h-8 max-w-[200px] flex-row items-center gap-1.5 rounded-full pl-2.5 pr-1",
        className,
      )}
      style={style}
    >
      {leading}
      <CustomText
        numberOfLines={1}
        className={cn("shrink font-sans-semibold text-[13px]", textClass)}
      >
        {label}
      </CustomText>
      <MotionPressable
        role="button"
        accessibilityLabel={`Remove the ${label} filter`}
        onPress={onRemove}
        hitSlop={8}
        className="h-6 w-6 items-center justify-center rounded-full active:opacity-60"
      >
        <CustomIcon as={X} size={14} strokeWidth={2.4} className={textClass} />
      </MotionPressable>
    </View>
  );
}
