import {
  Check,
  CircleX,
  Copy,
  Pause,
  Pencil,
  Search,
  Send,
  Tags,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useSmoothMotion } from "@/features/messaging/hooks/use-smooth-motion";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { MAX_TAGS } from "../services/broadcasts-api";
import { loadTags } from "../services/broadcasts-service";
import { selectBroadcastTags } from "../store/broadcasts-selectors";
import type { Broadcast } from "../types";

export type BroadcastCardAction =
  "edit" | "editMessage" | "resume" | "pause" | "sendNow" | "duplicate" | "cancel" | "delete";
/** What came of an action: an error to show, a line to confirm it, or nothing to say. */
export type BroadcastActionResult = { error: string } | { notice: string } | null;

type Item = {
  key: BroadcastCardAction | "tags";
  label: string;
  icon: LucideIcon;
  description?: string;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * The web app's row menu for a draft, a scheduled, paused, sending or finished broadcast, without View broadcast, View runs
 * and Resume (the card opens the broadcast, and a paused card resumes from its footer). A draft opens in the
 * builder; a scheduled or paused one changes only its message.
 */
function itemsFor(broadcast: Broadcast): (Item | "separator")[] {
  const editMessage: Item = { key: "editMessage", label: "Edit message", icon: Pencil };
  const cancel: Item = { key: "cancel", label: "Cancel sending", icon: CircleX, danger: true };
  if (broadcast.status === "DRAFT")
    return [
      { key: "edit", label: "Edit", icon: Pencil },
      { key: "duplicate", label: "Duplicate", icon: Copy },
      "separator",
      { key: "delete", label: "Delete", icon: Trash2, danger: true },
    ];
  if (broadcast.status === "SCHEDULED")
    return [
      editMessage,
      // Moving a repeating broadcast's start would shift its whole series.
      ...(broadcast.repeat.type === "NONE"
        ? [{ key: "sendNow", label: "Send now", icon: Send } as Item]
        : []),
      {
        key: "pause",
        label: "Pause",
        icon: Pause,
        description:
          broadcast.repeat.type === "NONE" ? "Hold the scheduled send" : "Hold every upcoming send",
      },
      { key: "duplicate", label: "Duplicate", icon: Copy },
      "separator",
      cancel,
    ];
  if (broadcast.status === "PAUSED")
    return [{ key: "tags", label: "Edit tags", icon: Tags }, editMessage, "separator", cancel];
  // Sending now: it can be copied, held, its message changed for those not sent yet, or retagged
  // (not cancelled mid-run, and its audience and numbers stay: the API refuses those while a run is live).
  if (broadcast.status === "RUNNING")
    return [
      { key: "duplicate", label: "Duplicate", icon: Copy },
      { key: "pause", label: "Pause", icon: Pause },
      editMessage,
      { key: "tags", label: "Edit tags", icon: Tags },
    ];
  // Finished (completed, failed or partly sent): copy it to send again, or retag it.
  if (
    broadcast.status === "COMPLETED" ||
    broadcast.status === "FAILED" ||
    broadcast.status === "PARTIALLY_COMPLETED"
  )
    return [
      { key: "duplicate", label: "Duplicate", icon: Copy },
      { key: "tags", label: "Edit tags", icon: Tags },
    ];
  return [];
}

/** Whether the card shows its options button: only the statuses the menu covers. */
export const hasCardActions = (broadcast: Broadcast) => itemsFor(broadcast).length > 0;

/** Cancel and Delete ask first, in the web's words. */
const CONFIRM = {
  cancel: {
    title: (name: string) => `Cancel “${name}”?`,
    body: "Messages not sent yet won't go out, and it's removed from your broadcasts. Messages already sent stay delivered.",
    confirm: "Cancel broadcast",
    keep: "Keep it",
  },
  delete: {
    title: (name: string) => `Delete “${name}”?`,
    body: "The draft is removed. This can't be undone.",
    confirm: "Delete draft",
    keep: "Keep draft",
  },
};

/** The forms a pick opens inside the card, as the WhatsApp number card's: Edit tags, or Cancel / Delete. */
export type CardPanel = "tags" | "cancel" | "delete";
/** A menu pick: an action to run, or a form to open in the card. */
export type BroadcastMenuPick = BroadcastCardAction | "tags";
/** Opened into the card instead of run straight away. A draft's Delete runs at once, without asking. */
export const panelFor = (pick: BroadcastMenuPick): CardPanel | null =>
  pick === "tags" || pick === "cancel" ? pick : null;

/** About how tall the menu is, so the screen can open it above the button when it wouldn't fit below. */
export const menuHeight = (broadcast: Broadcast) =>
  8 +
  itemsFor(broadcast).reduce(
    (sum, item) => sum + (item === "separator" ? 9 : item.description ? 56 : 44),
    0,
  );
export const MENU_WIDTH = 248;

/**
 * A broadcast's "…" options, as the WhatsApp number card's menu: laid over the list right under its button
 * (positioned by the screen), so opening it doesn't push the cards below it down.
 */
export function BroadcastMenu({
  broadcast,
  top,
  right,
  onPick,
}: {
  broadcast: Broadcast;
  top: number;
  right: number;
  onPick: (pick: BroadcastMenuPick) => void;
}) {
  const { colors } = useRokloTheme();
  const motion = useSmoothMotion();
  return (
    <Animated.View
      {...motion.menu}
      style={{ position: "absolute", top, right, width: MENU_WIDTH, zIndex: 20 }}
    >
      <View
        accessibilityLabel={`Options for ${broadcast.name}`}
        className="overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg shadow-black/30 elevation-8"
      >
        {itemsFor(broadcast).map((item, index) =>
          item === "separator" ? (
            <View key={`separator-${index}`} className="my-1 h-px bg-border" />
          ) : (
            <MotionPressable
              key={item.key}
              role="button"
              accessibilityLabel={
                item.description ? `${item.label}. ${item.description}` : item.label
              }
              accessibilityState={{ disabled: !!item.disabled }}
              disabled={item.disabled}
              onPress={() => onPick(item.key)}
              className="min-h-11 flex-row items-center gap-2.5 py-2 pl-3 pr-4 active:bg-accent"
              style={{ opacity: item.disabled ? 0.45 : 1 }}
            >
              <CustomIcon
                as={item.icon}
                size={17}
                color={item.danger ? colors["error-fg"] : colors.foreground}
              />
              <View className="min-w-0 flex-1">
                {/* "simple" breaking keeps Android from measuring the custom font short and clipping the last letters. */}
                <CustomText
                  numberOfLines={1}
                  textBreakStrategy="simple"
                  className={cn(
                    "font-sans-medium text-sm",
                    item.danger ? "text-error-fg" : "text-foreground",
                  )}
                >
                  {item.label}
                </CustomText>
                {!!item.description && (
                  <CustomText numberOfLines={1} className="text-xs text-muted-foreground">
                    {item.description}
                  </CustomText>
                )}
              </View>
            </MotionPressable>
          ),
        )}
      </View>
    </Animated.View>
  );
}

/** The picked form, inside the card: its tags to edit, or Cancel / Delete to confirm. */
export function CardPanelView({
  broadcast,
  panel,
  onConfirm,
  onSaveTags,
  onClose,
}: {
  broadcast: Broadcast;
  panel: CardPanel;
  /** Cancel or Delete: resolves to an error to show, or null once done. */
  onConfirm: (action: "cancel" | "delete") => Promise<string | null>;
  onSaveTags: (broadcast: Broadcast, tagIds: string[]) => Promise<string | null>;
  onClose: (notice?: string) => void;
}) {
  const motion = useSmoothMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm(action: "cancel" | "delete") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await onConfirm(action);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Animated.View key={panel} {...motion.panel} className="border-t border-border bg-card">
      {panel === "tags" ? (
        <TagEditor
          broadcast={broadcast}
          onSave={onSaveTags}
          onBack={() => onClose()}
          onSaved={() => onClose("Tags saved")}
        />
      ) : (
        <View
          role="alert"
          className="m-3 gap-2 rounded-2xl border border-error-border bg-error-bg p-3.5"
        >
          <CustomText className="font-sans-semibold text-sm text-error-fg">
            {CONFIRM[panel].title(broadcast.name)}
          </CustomText>
          <CustomText className="text-xs leading-5 text-error-fg">{CONFIRM[panel].body}</CustomText>
          {error && (
            <CustomText className="text-xs font-sans-semibold text-error-fg">{error}</CustomText>
          )}
          <View className="flex-row flex-wrap gap-2 pt-1">
            <CustomButton
              size="sm"
              variant="destructive-solid"
              loading={busy}
              onPress={() => void confirm(panel)}
            >
              {CONFIRM[panel].confirm}
            </CustomButton>
            <CustomButton size="sm" variant="ghost" disabled={busy} onPress={() => onClose()}>
              {CONFIRM[panel].keep}
            </CustomButton>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/** Its tags as a checklist (up to 5), saved together; the workspace's broadcast tags come from the slice. */
function TagEditor({
  broadcast,
  onSave,
  onBack,
  onSaved,
}: {
  broadcast: Broadcast;
  onSave: (broadcast: Broadcast, tagIds: string[]) => Promise<string | null>;
  onBack: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const { colors } = useRokloTheme();
  const { items: tags, error: loadError } = useAppSelector(selectBroadcastTags);
  const [picked, setPicked] = useState(() => broadcast.tags.map((tag) => tag.id));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void dispatch(loadTags());
  }, [dispatch]);

  const full = picked.length >= MAX_TAGS;
  const term = query.trim().toLowerCase();
  const matching = (tags ?? []).filter((tag) => !term || tag.name.toLowerCase().includes(term));
  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((tagId) => tagId !== id) : [...now, id]));
  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const problem = await onSave(broadcast, picked);
    setSaving(false);
    if (problem) setError(problem);
    else onSaved();
  }

  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <CustomText className="font-sans-semibold text-sm">Edit tags</CustomText>
        <CustomText className="text-xs text-muted-foreground">
          {picked.length ? `${picked.length} of ${MAX_TAGS} selected` : `Up to ${MAX_TAGS} tags`}
        </CustomText>
      </View>
      {!tags ? (
        loadError ? (
          <View className="gap-1">
            <CustomText className="text-[13px] text-error-fg">{loadError}</CustomText>
            <CustomButton
              variant="link"
              size="sm"
              className="self-start px-0"
              onPress={() => void dispatch(loadTags(true))}
            >
              Try again
            </CustomButton>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 py-2">
            <CustomSpinner size="small" />
            <CustomText className="text-[13px] text-muted-foreground">Loading tags…</CustomText>
          </View>
        )
      ) : (
        <>
          {tags.length > 8 && (
            <View className="flex-row items-center gap-2 rounded-xl bg-accent px-3">
              <CustomIcon as={Search} size={16} className="text-muted-foreground" />
              <CustomInput
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search tags"
                accessibilityLabel="Search tags"
                size="lg"
                className="min-w-0 flex-1 border-0 bg-transparent px-1"
              />
            </View>
          )}
          <View>
            {matching.length ? (
              matching.map((tag) => {
                const on = picked.includes(tag.id);
                const blocked = full && !on;
                return (
                  <MotionPressable
                    key={tag.id}
                    role="checkbox"
                    accessibilityLabel={tag.name}
                    accessibilityState={{ checked: on, disabled: blocked }}
                    disabled={blocked}
                    onPress={() => toggle(tag.id)}
                    className="min-h-11 flex-row items-center gap-2.5 rounded-lg px-2.5 active:bg-accent"
                    style={{
                      opacity: blocked ? 0.4 : 1,
                      ...(on && { backgroundColor: colors.accent }),
                    }}
                  >
                    <View
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color ?? colors["ink-400"] }}
                    />
                    <CustomText numberOfLines={1} className="flex-1 text-sm">
                      {tag.name}
                    </CustomText>
                    {on && (
                      <CustomIcon as={Check} size={16} strokeWidth={2.6} className="text-primary" />
                    )}
                  </MotionPressable>
                );
              })
            ) : (
              <CustomText className="py-3 text-[13px] text-muted-foreground">
                {tags.length
                  ? "No matching tags."
                  : "No broadcast tags yet. Create them when you make a broadcast."}
              </CustomText>
            )}
          </View>
        </>
      )}
      {error && (
        <CustomText role="alert" className="text-xs text-error-fg">
          {error}
        </CustomText>
      )}
      <View className="flex-row flex-wrap gap-2 pt-1">
        <CustomButton size="sm" loading={saving} disabled={!tags} onPress={() => void save()}>
          Save tags
        </CustomButton>
        <CustomButton size="sm" variant="ghost" disabled={saving} onPress={onBack}>
          Back
        </CustomButton>
      </View>
    </View>
  );
}
