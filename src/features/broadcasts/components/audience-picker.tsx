import {
  Check,
  Info,
  List,
  MessagesSquare,
  Search,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { WhatsAppMark } from "@/features/messaging/components/whatsapp-mark";
import { numberPhone } from "@/features/messaging/types";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadMoreContacts, postableGroups, searchAudience } from "../services/broadcasts-service";
import { selectAudience } from "../store/broadcasts-selectors";
import { audienceKey, canPostTo, type AudienceTab as Tab } from "../store/broadcasts-thunks";
import type { AvailableGroup, NewAudience } from "../types";
import { formatCount, plural } from "../utils/broadcast-format";

/** Rows shown before "Show more" (groups come whole from the API). */
const STEP = 30;
/** Picked chips shown before "+N more". */
const CHIP_LIMIT = 5;

type Chip = { key: string; name: string; icon: LucideIcon; tone: string; remove: () => void };
/** A slot in the "Selected" grid: a picked chip, or the button that opens or closes the rest. */
type ChipCell = Chip | "more" | "less";
const cellKey = (cell: ChipCell) => (typeof cell === "string" ? cell : cell.key);
/** Rows of two. */
const pairs = <T,>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / 2) }, (_, row) =>
    items.slice(row * 2, row * 2 + 2),
  );

export const audienceCount = (audience: NewAudience) =>
  audience.contacts.length + audience.rokloGroups.length + audience.waGroups.length;
/** Private chats: each Roklo list's contacts plus the contacts picked one by one. */
export const directChats = (audience: NewAudience) =>
  audience.contacts.length +
  audience.rokloGroups.reduce((sum, group) => sum + group.memberCount, 0);
/** A picked segment's raised card look, as a style. */
export const raised = (background: string) => ({
  backgroundColor: background,
  shadowColor: "#000000",
  shadowOpacity: 0.1,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
});

/**
 * "Who should get this?", as the web builder's audience step: Roklo lists, WhatsApp groups (those the picked
 * numbers are in) and contacts, each searchable with a tick per row, then what's selected as chips with the
 * private chats and group posts it adds up to. A change of numbers drops WhatsApp groups none of them can post in.
 */
export function AudiencePicker({
  value,
  onChange,
  sessionIds,
  error,
  onSearchFocus,
}: {
  value: NewAudience;
  onChange: (next: NewAudience) => void;
  sessionIds: string[];
  error?: string | null;
  /** The search is focused: the form scrolls its bar up so the results show above the keyboard. */
  onSearchFocus?: (searchBar: View) => void;
}) {
  const { colors } = useRokloTheme();
  const searchBar = useRef<View>(null);
  const dispatch = useAppDispatch();
  // The list on screen, in the `broadcasts` slice, for one tab, search and set of numbers.
  const audience = useAppSelector(selectAudience);
  const [tab, setTab] = useState<Tab>("roklo");
  const [queries, setQueries] = useState<Record<Tab, string>>({ roklo: "", wa: "", contacts: "" });
  const [search, setSearch] = useState("");
  const [pruned, setPruned] = useState<number>(0);
  const query = queries[tab];
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const sessionKey = sessionIds.join(",");
  // Another tab, search or numbers is loading until its answer comes.
  const key = audienceKey(tab, search, sessionIds);
  const current = audience.key === key;
  const loading = !current || audience.status === "loading";
  const loadError = current && audience.status === "error" ? audience.error : null;
  const contacts = current ? audience.contacts : [];
  const groups = current ? audience.groups : [];
  const [more, setMore] = useState({ key, count: STEP });
  const shown = more.key === key ? more.count : STEP;
  const showMore = () => setMore({ key, count: shown + STEP });
  const fetchList = useCallback(
    () => void dispatch(searchAudience(tab, search, sessionKey ? sessionKey.split(",") : [])),
    [dispatch, tab, search, sessionKey],
  );
  useEffect(() => {
    // WhatsApp groups are the picked numbers' groups: none to list without a number.
    if (tab === "wa" && !sessionKey) return;
    fetchList();
  }, [tab, sessionKey, fetchList]);

  // A change of numbers drops picked WhatsApp groups none of them can post in, as on the web.
  const pickedWa = value.waGroups.length;
  useEffect(() => {
    if (!sessionKey || !pickedWa) return;
    let cancelled = false;
    void dispatch(postableGroups(sessionKey.split(","))).then((postable) => {
      if (cancelled || !postable) return;
      const kept = value.waGroups.filter((group) => postable.has(group.id));
      if (kept.length !== value.waGroups.length) {
        setPruned(value.waGroups.length - kept.length);
        onChange({ ...value, waGroups: kept });
      }
    });
    return () => {
      cancelled = true;
    };
    // Only a change of numbers re-checks; the picked groups are read as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, dispatch]);

  async function moreContacts() {
    await dispatch(loadMoreContacts());
    showMore();
  }
  const toggleContact = (contact: { id: string; name: string | null; mobileNumber: string }) =>
    onChange({
      ...value,
      contacts: value.contacts.some((row) => row.id === contact.id)
        ? value.contacts.filter((row) => row.id !== contact.id)
        : [
            ...value.contacts,
            {
              id: contact.id,
              name: contact.name || contact.mobileNumber,
              phone: numberPhone({ phoneNumber: contact.mobileNumber }),
            },
          ],
    });
  const toggleGroup = (group: AvailableGroup) => {
    const list = group.type === "WA" ? "waGroups" : "rokloGroups";
    onChange({
      ...value,
      [list]: value[list].some((row) => row.id === group.id)
        ? value[list].filter((row) => row.id !== group.id)
        : [...value[list], { id: group.id, name: group.name, memberCount: group.memberCount }],
    });
  };
  const chips: Chip[] = [
    ...value.rokloGroups.map((row) => ({
      key: `r:${row.id}`,
      name: row.name,
      icon: List,
      tone: "text-primary",
      remove: () =>
        onChange({ ...value, rokloGroups: value.rokloGroups.filter((item) => item.id !== row.id) }),
    })),
    ...value.waGroups.map((row) => ({
      key: `w:${row.id}`,
      name: row.name,
      icon: MessagesSquare,
      tone: "text-info-fg",
      remove: () =>
        onChange({ ...value, waGroups: value.waGroups.filter((item) => item.id !== row.id) }),
    })),
    ...value.contacts.map((row) => ({
      key: `c:${row.id}`,
      name: row.name,
      icon: UserRound,
      tone: "text-ink-700",
      remove: () =>
        onChange({ ...value, contacts: value.contacts.filter((item) => item.id !== row.id) }),
    })),
  ];
  // The first CHIP_LIMIT chips, then "+N more"; opened, all of them and "Show less".
  const [chipsOpen, setChipsOpen] = useState(false);
  const hidden = chipsOpen ? 0 : Math.max(0, chips.length - CHIP_LIMIT);
  const cells: ChipCell[] = hidden
    ? [...chips.slice(0, CHIP_LIMIT), "more"]
    : chips.length > CHIP_LIMIT
      ? [...chips, "less"]
      : chips;
  const tabs: { value: Tab; label: string; icon: LucideIcon; count: number }[] = [
    { value: "roklo", label: "Roklo lists", icon: List, count: value.rokloGroups.length },
    { value: "wa", label: "Groups", icon: MessagesSquare, count: value.waGroups.length },
    { value: "contacts", label: "Contacts", icon: UserRound, count: value.contacts.length },
  ];
  const chats = directChats(value);

  return (
    <View className="gap-3">
      {/* The picked tab's card look goes on as a style: a pressable whose classes gain a new kind of style
        after its first render is re-created by NativeWind, and its dev warning crashes (navigation context). */}
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Audience type"
        className="flex-row gap-1 rounded-xl bg-accent p-1"
      >
        {tabs.map((item) => {
          const on = tab === item.value;
          return (
            <MotionPressable
              key={item.value}
              role="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${item.label}${item.count ? `, ${item.count} picked` : ""}`}
              onPress={() => setTab(item.value)}
              className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-1"
              style={on ? raised(colors.card) : undefined}
            >
              <CustomText
                numberOfLines={1}
                className={cn(
                  "text-[13px]",
                  on
                    ? "font-sans-semibold text-foreground"
                    : "font-sans-medium text-muted-foreground",
                )}
              >
                {item.label}
              </CustomText>
              {item.count > 0 && (
                <View className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1">
                  <CustomText className="font-sans-semibold text-[10px] text-primary-foreground">
                    {item.count}
                  </CustomText>
                </View>
              )}
            </MotionPressable>
          );
        })}
      </View>

      <View
        ref={searchBar}
        className="flex-row items-center gap-2 rounded-xl border border-input bg-card px-3"
      >
        <CustomIcon as={Search} size={18} className="text-muted-foreground" />
        <CustomInput
          value={query}
          onChangeText={(text) => setQueries((old) => ({ ...old, [tab]: text }))}
          size="lg"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={200}
          onFocus={() => {
            if (searchBar.current) onSearchFocus?.(searchBar.current);
          }}
          placeholder={
            tab === "roklo"
              ? "Search Roklo lists"
              : tab === "wa"
                ? "Search WhatsApp groups"
                : "Search name or number"
          }
          accessibilityLabel={
            tab === "roklo"
              ? "Search Roklo lists"
              : tab === "wa"
                ? "Search WhatsApp groups"
                : "Search contacts"
          }
          className="min-w-0 flex-1 border-0 bg-transparent px-1"
        />
        {!!query && (
          <MotionPressable
            role="button"
            accessibilityLabel="Clear search"
            onPress={() => setQueries((old) => ({ ...old, [tab]: "" }))}
            className="h-10 w-8 items-center justify-center"
          >
            <CustomIcon as={X} size={16} className="text-muted-foreground" />
          </MotionPressable>
        )}
      </View>

      {tab === "wa" && (
        <View className="flex-row gap-2.5 rounded-xl border border-info-border bg-info-bg px-3 py-2.5">
          <CustomIcon as={Info} size={15} className="mt-0.5 text-info-fg" />
          <CustomText className="flex-1 text-[13px] leading-5 text-info-fg">
            Your message is posted once in each group and every member sees it.{" "}
            <CustomText className="font-mono text-xs text-info-fg">{"{{name}}"}</CustomText> becomes
            “everyone” in group posts.
          </CustomText>
        </View>
      )}
      {pruned > 0 && (
        <View className="flex-row items-center gap-2 rounded-xl bg-accent px-3 py-2.5">
          <CustomText className="flex-1 text-[13px] text-ink-700">{`Removed ${plural(pruned, "WhatsApp group")} the picked numbers can't post in.`}</CustomText>
          <MotionPressable
            role="button"
            accessibilityLabel="Dismiss"
            onPress={() => setPruned(0)}
            hitSlop={8}
          >
            <CustomIcon as={X} size={15} className="text-muted-foreground" />
          </MotionPressable>
        </View>
      )}

      {tab === "wa" && !sessionKey ? (
        <Empty text="Pick a number under “Send from” to see its WhatsApp groups." boxed />
      ) : loadError ? (
        <View className="gap-1">
          <CustomText className="text-sm text-error-fg">{loadError}</CustomText>
          <CustomButton variant="link" onPress={fetchList}>
            Try again
          </CustomButton>
        </View>
      ) : loading ? (
        <View className="items-center py-6">
          <CustomSpinner accessibilityLabel="Loading" />
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-border">
          {tab === "contacts" ? (
            <>
              {contacts.length === 0 && (
                <Empty
                  text={search ? "No matching contacts." : "No contacts yet. Add them in Contacts."}
                />
              )}
              {contacts.slice(0, shown).map((contact, index) => (
                <Row
                  key={contact.id}
                  first={index === 0}
                  checked={value.contacts.some((row) => row.id === contact.id)}
                  onPress={() => toggleContact(contact)}
                  // Only a number, no name: a person icon rather than digits as initials.
                  leading={
                    contact.name?.trim() && contact.name !== contact.mobileNumber ? (
                      <CustomAvatar name={contact.name} size={36} />
                    ) : (
                      <View className="h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-brand-50">
                        <CustomIcon as={UserRound} size={18} className="text-brand-800" />
                      </View>
                    )
                  }
                  title={contact.name || contact.mobileNumber}
                  detail={numberPhone({ phoneNumber: contact.mobileNumber })}
                />
              ))}
              {(contacts.length > shown || audience.contactsMore) && (
                <MoreButton
                  onPress={() => (contacts.length > shown ? showMore() : void moreContacts())}
                />
              )}
            </>
          ) : (
            <>
              {groups.length === 0 && (
                <Empty
                  text={
                    search
                      ? "No matching groups."
                      : tab === "wa"
                        ? "The picked numbers aren't in any WhatsApp groups yet."
                        : "No Roklo lists yet. Create them in Contacts."
                  }
                />
              )}
              {groups.slice(0, shown).map((group, index) => {
                const list = group.type === "WA" ? value.waGroups : value.rokloGroups;
                const checked = list.some((row) => row.id === group.id);
                const locked = !canPostTo(group);
                return (
                  <Row
                    key={group.id}
                    first={index === 0}
                    checked={checked}
                    disabled={locked && !checked}
                    onPress={() => toggleGroup(group)}
                    leading={
                      <View
                        className={cn(
                          "h-9 w-9 items-center justify-center rounded-full",
                          group.type === "WA" ? "bg-brand-50" : "bg-info-bg",
                        )}
                      >
                        {group.type === "WA" ? (
                          <WhatsAppMark size={18} />
                        ) : (
                          <CustomIcon as={UsersRound} size={16} className="text-info-fg" />
                        )}
                      </View>
                    }
                    title={group.name}
                    detail={
                      locked
                        ? "Only admins can post"
                        : `${formatCount(group.memberCount)} ${group.memberCount === 1 ? "member" : "members"}`
                    }
                  />
                );
              })}
              {groups.length > shown && <MoreButton onPress={showMore} />}
            </>
          )}
        </View>
      )}

      {/* What's picked, as the web's "Selected" box. */}
      <View
        role={error ? "alert" : undefined}
        accessibilityLabel="Selected audience"
        className={cn(
          "gap-2.5 rounded-2xl border bg-ink-25 p-3.5",
          error ? "border-error-border-strong" : "border-border",
        )}
      >
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <CustomText className="font-sans-semibold text-[13px] text-ink-900">Selected</CustomText>
          <CustomText className="text-[13px] text-ink-600" accessibilityLiveRegion="polite">
            {formatCount(chats)} private chat{chats === 1 ? "" : "s"} ·{" "}
            {plural(value.waGroups.length, "group post")}
          </CustomText>
        </View>
        {chips.length === 0 ? (
          <CustomText className={cn("text-[13px]", error ? "text-error-fg" : "text-ink-500")}>
            {error ?? "Nothing selected yet"}
          </CustomText>
        ) : (
          // Two to a row; the first few, then "+N more" in the next slot to open them all here.
          <View className="gap-1.5">
            {pairs(cells).map((row) => (
              <View key={row.map(cellKey).join("|")} className="flex-row gap-1.5">
                {row.map((cell) =>
                  cell === "more" || cell === "less" ? (
                    <MotionPressable
                      key={cell}
                      role="button"
                      accessibilityState={{ expanded: cell === "less" }}
                      accessibilityLabel={
                        cell === "more"
                          ? `Show ${formatCount(hidden)} more selected`
                          : "Show fewer selected"
                      }
                      onPress={() => setChipsOpen(cell === "more")}
                      className="h-8 min-w-0 flex-1 items-center justify-center rounded-full border border-dashed border-ink-300 bg-card active:bg-accent"
                    >
                      <CustomText
                        numberOfLines={1}
                        className="font-sans-semibold text-[13px] text-primary"
                      >
                        {cell === "more" ? `+${formatCount(hidden)} more` : "Show less"}
                      </CustomText>
                    </MotionPressable>
                  ) : (
                    <View
                      key={cell.key}
                      className="h-8 min-w-0 flex-1 flex-row items-center gap-1.5 rounded-full border border-border bg-card pl-2.5 pr-1"
                    >
                      <CustomIcon as={cell.icon} size={13} className={cell.tone} />
                      <CustomText
                        numberOfLines={1}
                        className="min-w-0 flex-1 font-sans-medium text-[13px]"
                      >
                        {cell.name}
                      </CustomText>
                      <MotionPressable
                        role="button"
                        accessibilityLabel={`Remove ${cell.name}`}
                        onPress={cell.remove}
                        hitSlop={6}
                        className="h-6 w-6 items-center justify-center rounded-full active:bg-accent"
                      >
                        <CustomIcon as={X} size={13} className="text-muted-foreground" />
                      </MotionPressable>
                    </View>
                  ),
                )}
                {/* An odd last chip keeps its half width. */}
                {row.length === 1 && <View className="flex-1" />}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Row({
  first,
  checked,
  disabled,
  onPress,
  leading,
  title,
  detail,
}: {
  first: boolean;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
  leading: ReactNode;
  title: string;
  detail: string;
}) {
  const { colors } = useRokloTheme();
  // Fixed classes; what changes (picked, first, disabled) goes on as a style (see the tabs above).
  return (
    <MotionPressable
      role="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={`${title}, ${detail}`}
      disabled={disabled}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 border-t border-border bg-card px-3 py-2 active:bg-accent"
      style={{
        borderTopWidth: first ? 0 : 1,
        opacity: disabled ? 0.5 : 1,
        ...(checked && { backgroundColor: colors["brand-50"] }),
      }}
    >
      {leading}
      <View className="min-w-0 flex-1">
        <CustomText numberOfLines={1} className="font-sans-medium text-[15px]">
          {title}
        </CustomText>
        <CustomText numberOfLines={1} className="text-xs text-muted-foreground">
          {detail}
        </CustomText>
      </View>
      <View
        className={cn(
          "h-6 w-6 items-center justify-center rounded-full border-2",
          checked ? "border-primary bg-primary" : "border-ink-300",
        )}
      >
        {checked && (
          <CustomIcon as={Check} size={13} strokeWidth={3} className="text-primary-foreground" />
        )}
      </View>
    </MotionPressable>
  );
}

function Empty({ text, boxed }: { text: string; boxed?: boolean }) {
  return (
    <View
      className={cn(
        "items-center bg-card px-4 py-6",
        boxed && "rounded-2xl border border-dashed border-border",
      )}
    >
      <CustomText className="text-center text-sm text-muted-foreground">{text}</CustomText>
    </View>
  );
}

function MoreButton({ onPress }: { onPress: () => void }) {
  return (
    <MotionPressable
      role="button"
      accessibilityLabel="Show more"
      onPress={onPress}
      className="h-11 items-center justify-center border-t border-border bg-card active:bg-accent"
    >
      <CustomText className="font-sans-semibold text-sm text-primary">Show more</CustomText>
    </MotionPressable>
  );
}
