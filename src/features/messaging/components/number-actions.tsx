import { Eye, Pencil, Trash2, Unlink, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { useSmoothMotion } from "../hooks/use-smooth-motion";
import { useMessaging } from "../providers/messaging-provider";
import { VisibilityForm } from "./visibility-form";
import { numberName, type WhatsAppNumber } from "../types";
import { deleteCachedNumber } from "../services/message-store";

/** The inline forms a number's card can open. */
export type NumberPanel = "rename" | "visibility" | "disconnect" | "remove";

/**
 * The "…" options for one number: Rename, Change visibility, Disconnect (while connected), Remove number.
 * Laid over the list right under its "…" button (positioned by the screen), so opening it doesn't push the rows below it down.
 */
export function NumberActionMenu({
  top,
  canChangeVisibility,
  onRename,
  onVisibility,
  onDisconnect,
  onRemove,
}: {
  top: number;
  canChangeVisibility: boolean;
  onRename: () => void;
  onVisibility: () => void;
  /** Only while the phone is linked, as the web app's "Unlink phone". */
  onDisconnect?: () => void;
  onRemove: () => void;
}) {
  const motion = useSmoothMotion();
  return (
    <Animated.View {...motion.menu} style={{ position: "absolute", top, right: 16, zIndex: 20 }}>
      <View className="overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg shadow-black/30 elevation-8">
        <ActionItem icon={Pencil} label="Rename" onPress={onRename} />
        {canChangeVisibility && (
          <ActionItem icon={Eye} label="Change visibility" onPress={onVisibility} />
        )}
        {onDisconnect && <ActionItem icon={Unlink} label="Disconnect" onPress={onDisconnect} />}
        <View className="my-1 h-px bg-border" />
        <ActionItem icon={Trash2} label="Remove number" danger onPress={onRemove} />
      </View>
    </Animated.View>
  );
}

function ActionItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-2.5 pl-3 pr-4 active:bg-accent"
    >
      <CustomIcon as={icon} size={17} className={danger ? "text-error-fg" : "text-foreground"} />
      {/* "simple" breaking keeps Android from measuring the custom font short and clipping the last letters. */}
      <CustomText
        numberOfLines={1}
        textBreakStrategy="simple"
        className={cn("font-sans-medium text-sm", danger ? "text-error-fg" : "text-foreground")}
      >
        {label}
      </CustomText>
    </MotionPressable>
  );
}

/** The form for the option picked in the menu, inside the number's card. */
export function NumberActionPanel({
  panel,
  number,
  isOwner,
  onDone,
}: {
  panel: NumberPanel;
  number: WhatsAppNumber;
  isOwner: boolean;
  onDone: () => void;
}) {
  return panel === "rename" ? (
    <RenameForm number={number} onDone={onDone} />
  ) : panel === "visibility" ? (
    <VisibilityForm number={number} isOwner={isOwner} onDone={onDone} />
  ) : panel === "disconnect" ? (
    <DisconnectConfirm number={number} onDone={onDone} />
  ) : (
    <RemoveConfirm number={number} onDone={onDone} />
  );
}

function FormActions({
  saveLabel,
  busy,
  disabled,
  destructive,
  onSave,
  onCancel,
}: {
  saveLabel: string;
  busy: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="flex-row gap-2">
      <CustomButton
        size="sm"
        variant={destructive ? "destructive-solid" : "primary"}
        loading={busy}
        disabled={disabled}
        onPress={onSave}
      >
        {saveLabel}
      </CustomButton>
      <CustomButton size="sm" variant="ghost" disabled={busy} onPress={onCancel}>
        Cancel
      </CustomButton>
    </View>
  );
}

function RenameForm({ number, onDone }: { number: WhatsAppNumber; onDone: () => void }) {
  const { api, refreshNumbers } = useMessaging();
  const [name, setName] = useState(number.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await api.renameNumber(number.id, name.trim());
    if (!result.ok) {
      setBusy(false);
      setError(result.message || "Couldn't rename the number.");
      return;
    }
    await refreshNumbers();
    onDone();
  }
  return (
    <View className="gap-2">
      <CustomInput
        accessibilityLabel={`Name for ${numberName(number)}`}
        placeholder="Number name"
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoFocus
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      {error && <CustomText className="text-xs text-error-fg">{error}</CustomText>}
      <FormActions
        saveLabel="Save"
        busy={busy}
        disabled={!name.trim()}
        onSave={() => void save()}
        onCancel={onDone}
      />
    </View>
  );
}

/** Inline confirmation in place of a dialog. Unlike Remove, the number and its chats stay. */
function DisconnectConfirm({ number, onDone }: { number: WhatsAppNumber; onDone: () => void }) {
  const { api, refreshNumbers } = useMessaging();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await api.disconnectNumber(number.id);
    if (!result.ok) {
      setBusy(false);
      setError(result.message || "Couldn't disconnect the number. Try again.");
      return;
    }
    onDone();
    await refreshNumbers();
  }
  return (
    <View className="gap-3 rounded-xl border border-border bg-background p-3.5">
      <View className="gap-1">
        <CustomText className="font-sans-semibold text-sm">
          Disconnect {numberName(number)}?
        </CustomText>
        <CustomText className="text-xs leading-5 text-muted-foreground">
          WhatsApp on that phone logs out of Roklo and stops syncing chats. The number stays here,
          so you can link it again.
        </CustomText>
      </View>
      {error && (
        <CustomText className="text-xs font-sans-semibold text-error-fg">{error}</CustomText>
      )}
      <FormActions
        saveLabel="Disconnect"
        destructive
        busy={busy}
        onSave={() => void disconnect()}
        onCancel={onDone}
      />
    </View>
  );
}

/** Inline confirmation in place of a dialog: removing a number can't be undone. */
function RemoveConfirm({ number, onDone }: { number: WhatsAppNumber; onDone: () => void }) {
  const { api, refreshNumbers } = useMessaging();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await api.removeNumber(number.id);
    if (!result.ok) {
      setBusy(false);
      setError(result.message || "Couldn't remove the number. Try again.");
      return;
    }
    // Its chats went with it: so do their stored copies.
    void deleteCachedNumber(number.id);
    onDone();
    await refreshNumbers();
  }
  return (
    <View className="gap-3 rounded-xl border border-error-border bg-error-bg p-3.5">
      <View className="gap-1">
        <CustomText className="font-sans-semibold text-sm text-error-fg">
          Remove {numberName(number)}?
        </CustomText>
        <CustomText className="text-xs leading-5 text-error-fg">
          The phone is unlinked and the number is removed from this workspace. Its chats go with it.
          This can&apos;t be undone.
        </CustomText>
      </View>
      {error && (
        <CustomText className="text-xs font-sans-semibold text-error-fg">{error}</CustomText>
      )}
      <FormActions
        saveLabel="Remove number"
        destructive
        busy={busy}
        onSave={() => void remove()}
        onCancel={onDone}
      />
    </View>
  );
}
