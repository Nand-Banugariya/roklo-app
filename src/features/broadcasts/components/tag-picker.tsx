import { Check, ChevronDown, Plus, Search } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { FlatList, Keyboard, View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { MAX_TAGS, TAG_COLORS } from "../services/broadcasts-api";
import { createTag, loadTags } from "../services/broadcasts-service";
import { selectBroadcastTags } from "../store/broadcasts-selectors";

/**
 * Broadcast tags as a dropdown, as the web builder's tag field: one field showing the picked tags, opening
 * a list of every broadcast tag with a tick each (up to 5), search, and "Create …" with a colour for a new one.
 * Positioned as the login page's country picker is, so it stays clear of the keyboard.
 */
export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const dispatch = useAppDispatch();
  const { colors } = useRokloTheme();
  // The workspace's tags, read once into the `broadcasts` slice; a new one is added there.
  const { items: tags, error } = useAppSelector(selectBroadcastTags);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<{ name: string; color: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const trigger = useRef<ComponentRef<typeof PopoverTrigger>>(null);
  const viewport = useKeyboardViewport(open);
  useEffect(() => {
    void dispatch(loadTags());
  }, [dispatch]);
  // The keyboard can move the field while it's open: follow its new position, as the country picker does.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => trigger.current?.open(), 250);
    return () => clearTimeout(timer);
  }, [open, viewport.windowHeight, viewport.width, viewport.top, viewport.bottom]);

  const full = value.length >= MAX_TAGS;
  const term = query.trim().toLowerCase();
  const matching = (tags ?? []).filter((tag) => !term || tag.name.toLowerCase().includes(term));
  const canCreate = !!term && !(tags ?? []).some((tag) => tag.name.toLowerCase() === term);
  const picked = (tags ?? []).filter((tag) => value.includes(tag.id));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((tagId) => tagId !== id) : [...value, id]);
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setCreating(null);
      setCreateError(null);
    }
  }
  async function create() {
    if (!creating || saving) return;
    setSaving(true);
    setCreateError(null);
    const result = await dispatch(createTag(creating.name, creating.color));
    setSaving(false);
    if (!result.ok) {
      setCreateError(result.message || "Couldn't create the tag. Try again.");
      return;
    }
    // Picked when there's room, as on the web.
    if (!full) onChange([...value, result.data.id]);
    setCreating(null);
    setQuery("");
  }

  if (error && !tags)
    return (
      <View className="gap-1">
        <CustomText className="text-[13px] text-error-fg">{error}</CustomText>
        <CustomButton
          variant="link"
          size="sm"
          className="self-start px-0"
          onPress={() => void dispatch(loadTags(true))}
        >
          Try again
        </CustomButton>
      </View>
    );
  return (
    <Popover onOpenChange={changeOpen}>
      <PopoverTrigger ref={trigger} asChild disabled={!tags} onPress={() => Keyboard.dismiss()}>
        {/* Fixed classes (a pressable's classes mustn't gain new kinds of style after its first render). */}
        <Pressable
          role="button"
          accessibilityLabel={
            picked.length ? `Tags: ${picked.map((tag) => tag.name).join(", ")}. Change` : "Add tags"
          }
          className="min-h-12 flex-row items-center gap-2 rounded-xl border border-input bg-card py-2 pl-3 pr-2.5 active:bg-accent"
        >
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
            {!tags ? (
              <View className="flex-row items-center gap-2">
                <CustomSpinner size="small" />
                <CustomText className="text-[15px] text-muted-foreground">Loading tags…</CustomText>
              </View>
            ) : picked.length ? (
              picked.map((tag) => (
                <View
                  key={tag.id}
                  className="h-7 max-w-[150px] flex-row items-center gap-1.5 rounded-full px-2.5"
                  style={{
                    backgroundColor: tag.color?.length === 7 ? `${tag.color}1f` : colors.accent,
                  }}
                >
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color ?? colors["ink-400"] }}
                  />
                  <CustomText
                    numberOfLines={1}
                    className="shrink font-sans-medium text-[13px] text-foreground"
                  >
                    {tag.name}
                  </CustomText>
                </View>
              ))
            ) : (
              <CustomText className="text-[15px] text-muted-foreground">Add tags</CustomText>
            )}
          </View>
          <CustomIcon as={ChevronDown} size={18} className="text-muted-foreground" />
        </Pressable>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions
        accessibilityLabel="Broadcast tags"
        insets={{ top: viewport.top, bottom: viewport.bottom, left: 16, right: 16 }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="overflow-hidden rounded-2xl p-0"
        style={{ width: Math.min(360, viewport.width - 32), maxHeight: viewport.maxHeight }}
      >
        <View className="flex-row items-center gap-2 border-b border-border px-3">
          <CustomIcon as={Search} size={17} className="text-muted-foreground" />
          <CustomInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setCreating(null);
            }}
            size="lg"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            placeholder="Search or create a tag"
            accessibilityLabel="Search or create a tag"
            className="min-w-0 flex-1 border-0 bg-transparent px-1"
          />
        </View>

        {canCreate && !creating && (
          <Pressable
            role="button"
            accessibilityLabel={`Create tag ${query.trim()}`}
            onPress={() => setCreating({ name: query.trim(), color: TAG_COLORS[0] })}
            className="min-h-12 flex-row items-center gap-2.5 border-b border-border px-3 active:bg-accent"
          >
            <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-50">
              <CustomIcon as={Plus} size={14} className="text-primary" />
            </View>
            <CustomText
              numberOfLines={1}
              className="flex-1 font-sans-semibold text-sm text-primary"
            >
              Create “{query.trim()}”
            </CustomText>
          </Pressable>
        )}
        {creating && (
          <View className="gap-3 border-b border-border bg-background p-3">
            <CustomText className="text-[13px] text-ink-700">
              Colour for{" "}
              <CustomText className="font-sans-semibold text-[13px]">{creating.name}</CustomText>
            </CustomText>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2.5">
              {TAG_COLORS.map((color) => (
                <Pressable
                  key={color}
                  role="radio"
                  accessibilityLabel={color}
                  accessibilityState={{ checked: creating.color === color }}
                  onPress={() => setCreating({ ...creating, color })}
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: color }}
                >
                  {creating.color === color && (
                    <CustomIcon as={Check} size={15} strokeWidth={3} color="#ffffff" />
                  )}
                </Pressable>
              ))}
            </View>
            {createError && (
              <CustomText className="text-xs text-error-fg">{createError}</CustomText>
            )}
            <View className="flex-row gap-2">
              <CustomButton size="sm" loading={saving} onPress={() => void create()}>
                Create tag
              </CustomButton>
              <CustomButton
                size="sm"
                variant="ghost"
                disabled={saving}
                onPress={() => setCreating(null)}
              >
                Cancel
              </CustomButton>
            </View>
          </View>
        )}

        <FlatList
          data={matching}
          keyExtractor={(tag) => tag.id}
          keyboardShouldPersistTaps="always"
          style={{ maxHeight: 260 }}
          contentContainerStyle={{ padding: 4 }}
          ListEmptyComponent={
            canCreate ? null : (
              <CustomText className="px-3 py-4 text-[13px] text-muted-foreground">
                {tags?.length
                  ? "No matching tags."
                  : "No broadcast tags yet. Type a name to create one."}
              </CustomText>
            )
          }
          renderItem={({ item }) => {
            const on = value.includes(item.id);
            const blocked = full && !on;
            // Fixed classes; picked and disabled go on as a style.
            return (
              <Pressable
                role="checkbox"
                accessibilityState={{ checked: on, disabled: blocked }}
                accessibilityLabel={item.name}
                disabled={blocked}
                onPress={() => toggle(item.id)}
                className="min-h-11 flex-row items-center gap-2.5 rounded-lg px-2.5 active:bg-accent"
                style={{
                  opacity: blocked ? 0.4 : 1,
                  ...(on && { backgroundColor: colors.accent }),
                }}
              >
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color ?? colors["ink-400"] }}
                />
                <CustomText numberOfLines={1} className="flex-1 text-sm">
                  {item.name}
                </CustomText>
                {on && (
                  <CustomIcon as={Check} size={16} strokeWidth={2.6} className="text-primary" />
                )}
              </Pressable>
            );
          }}
        />

        <View className="flex-row items-center justify-between border-t border-border py-1 pl-3.5 pr-1.5">
          <CustomText className="text-xs text-muted-foreground">
            {value.length ? `${value.length} of ${MAX_TAGS} selected` : `Up to ${MAX_TAGS} tags`}
          </CustomText>
          <PopoverClose asChild>
            <Pressable
              role="button"
              accessibilityLabel="Done"
              className="h-10 justify-center rounded-lg px-3 active:bg-accent"
            >
              <CustomText className="font-sans-semibold text-sm text-primary">Done</CustomText>
            </Pressable>
          </PopoverClose>
        </View>
      </PopoverContent>
    </Popover>
  );
}
