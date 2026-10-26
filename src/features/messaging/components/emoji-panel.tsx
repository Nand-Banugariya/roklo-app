import { Apple, Clock, Delete, Hand, Heart, Lightbulb, PartyPopper, PawPrint, Search, Shapes, Smile, X, type LucideIcon } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, TextInput, View, useWindowDimensions } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { onboardingStorage as preferenceStorage } from "@/services/storage/onboarding-storage";
import { ALL_EMOJIS, EMOJI_CATEGORIES, type Emoji } from "../utils/emojis";

const RECENT_KEY = "roklo.recent-emojis";
const RECENT_MAX = 24;
/** About the keyboard's height, so the thread doesn't jump when the panel takes its place. */
export const EMOJI_PANEL_HEIGHT = 300;
const ICONS: Record<string, LucideIcon> = {
  recent: Clock, smileys: Smile, people: Hand, hearts: Heart, nature: PawPrint,
  food: Apple, activities: PartyPopper, objects: Lightbulb, symbols: Shapes,
};
const BY_CHAR = new Map(ALL_EMOJIS.map((emoji) => [emoji.char, emoji]));
const nameOf = (emoji: Emoji) => emoji.words[0].replace(/-/g, " ");

/**
 * The web app's emoji picker as WhatsApp's mobile panel: it takes the keyboard's place under the
 * composer (inline, never a popover), with recents, the same groups, search and a backspace key.
 */
export function EmojiPanel({ onPick, onBackspace, label = "Emoji" }: {
  onPick: (emoji: string) => void;
  /** Unset: no backspace key (picking a reaction). */
  onBackspace?: () => void;
  label?: string;
}) {
  const { colors } = useRokloTheme();
  const { width } = useWindowDimensions();
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState("smileys");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    let alive = true;
    void preferenceStorage.read(RECENT_KEY).catch(() => null).then((value) => {
      if (!alive || !value) return;
      try {
        const chars: unknown = JSON.parse(value);
        const known = Array.isArray(chars) ? chars.filter((char): char is string => BY_CHAR.has(char)) : [];
        setRecent(known);
        if (known.length) setActive((current) => current === "smileys" ? "recent" : current);
      } catch { /* a corrupt list starts empty */ }
    });
    return () => { alive = false; };
  }, []);
  const columns = Math.max(7, Math.floor((width - 16) / 46));
  const term = query.trim().toLowerCase();
  const emojis = useMemo(() => {
    if (term) return ALL_EMOJIS.filter((emoji) => emoji.words.some((word) => word.includes(term)));
    if (active === "recent") return recent.map((char) => BY_CHAR.get(char)!).filter(Boolean);
    return EMOJI_CATEGORIES.find((category) => category.id === active)?.emojis ?? [];
  }, [term, active, recent]);
  function pick(emoji: Emoji) {
    onPick(emoji.char);
    const next = [emoji.char, ...recent.filter((char) => char !== emoji.char)].slice(0, RECENT_MAX);
    setRecent(next);
    void preferenceStorage.write(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
  }
  const tabs = [...(recent.length ? [{ id: "recent", label: "Recent" }] : []), ...EMOJI_CATEGORIES.map(({ id, label }) => ({ id, label }))];
  return <View style={{ height: EMOJI_PANEL_HEIGHT }} className="mt-2 overflow-hidden rounded-card border border-ink-250 bg-card" accessibilityLabel={label}>
    {searching ? <View className="min-h-11 flex-row items-center gap-2 border-b border-ink-150 px-3">
      <CustomIcon as={Search} size={16} className="text-ink-500" />
      <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search emoji" placeholderTextColor={colors["ink-500"]}
        accessibilityLabel="Search emoji" autoCapitalize="none" autoCorrect={false}
        className="min-h-11 flex-1 font-sans text-[15px] text-foreground web:outline-none" />
      <MotionPressable role="button" accessibilityLabel="Close emoji search" onPress={() => { setQuery(""); setSearching(false); }}
        className="h-11 w-11 items-center justify-center"><CustomIcon as={X} size={17} className="text-ink-600" /></MotionPressable>
    </View> : <View className="flex-row items-center border-b border-ink-150">
      <MotionPressable role="button" accessibilityLabel="Search emoji" onPress={() => setSearching(true)} className="h-11 w-11 items-center justify-center">
        <CustomIcon as={Search} size={17} className="text-ink-600" />
      </MotionPressable>
      <FlatList data={tabs} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(tab) => tab.id} className="flex-1"
        renderItem={({ item: tab }) => <MotionPressable role="tab" accessibilityLabel={tab.label} aria-selected={active === tab.id}
          accessibilityState={{ selected: active === tab.id }} onPress={() => setActive(tab.id)}
          className={cn("h-11 w-11 items-center justify-center border-b-2", active === tab.id ? "border-primary" : "border-transparent")}>
          <CustomIcon as={ICONS[tab.id] ?? Smile} size={18} className={active === tab.id ? "text-primary" : "text-ink-500"} />
        </MotionPressable>} />
      {onBackspace && <MotionPressable role="button" accessibilityLabel="Delete" onPress={onBackspace} className="h-11 w-11 items-center justify-center">
        <CustomIcon as={Delete} size={19} className="text-ink-600" />
      </MotionPressable>}
    </View>}
    <FlatList key={columns} data={emojis} numColumns={columns} keyExtractor={(emoji) => emoji.char} keyboardShouldPersistTaps="always"
      contentContainerClassName="px-2 py-1.5" initialNumToRender={64}
      ListEmptyComponent={<CustomText className="py-8 text-center text-sm text-muted-foreground">{term ? "No emoji found" : "Emoji you use show up here"}</CustomText>}
      renderItem={({ item: emoji }) => <Pressable role="button" accessibilityLabel={nameOf(emoji)} onPress={() => pick(emoji)}
        style={{ width: `${100 / columns}%` }} className="h-11 items-center justify-center rounded-lg active:bg-accent">
        <CustomText className="text-[26px] leading-[32px]">{emoji.char}</CustomText>
      </Pressable>} />
  </View>;
}
