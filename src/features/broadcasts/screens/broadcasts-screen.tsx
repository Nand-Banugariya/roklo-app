import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { InboxState, Pulse } from "@/features/messaging/components/inbox-state";
import { useRealtimeEvent } from "@/features/messaging/hooks/use-realtime-event";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { numberName } from "@/features/messaging/types";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { TabScreen } from "@/features/navigation/components/tab-screen";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { router, useFocusEffect } from "expo-router";
import { Plus, Search, SearchX, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Pressable, View } from "react-native";
import { BroadcastArt } from "../components/broadcast-art";
import {
  BroadcastMenu,
  menuHeight,
  panelFor,
  type BroadcastActionResult,
  type BroadcastCardAction,
  type BroadcastMenuPick,
  type CardPanel,
} from "../components/broadcast-actions";
import { BroadcastCard } from "../components/broadcast-card";
import { LiveNow } from "../components/broadcasts-hero";
import { BroadcastsOverview } from "../components/broadcasts-overview";
import {
  ActiveFilters,
  FilterButton,
  FilterPanel,
  type BroadcastFilters,
} from "../components/status-filter";
import { LIVE_REFRESH_MS } from "../constants";
import {
  duplicateBroadcast,
  loadBroadcasts,
  loadTags,
  pauseBroadcast,
  removeBroadcast,
  resumeBroadcast,
  sendBroadcastNow,
  setBroadcastsQuery,
  updateBroadcastTags,
} from "../services/broadcasts-service";
import {
  selectBroadcastCounts,
  selectBroadcastRows,
  selectBroadcastsList,
  selectBroadcastTags,
} from "../store/broadcasts-selectors";
import type { Broadcast, BroadcastCounts, BroadcastFilter } from "../types";
import { plural } from "../utils/broadcast-format";

export function BroadcastsScreen() {
  return (
    <TabScreen tab="broadcasts">
      <BroadcastsContent />
    </TabScreen>
  );
}

/** How many each chip covers: Failed is any broadcast with failed messages, partly sent included. */
function chipCount(counts: BroadcastCounts | null, filter: BroadcastFilter) {
  if (!counts) return null;
  if (filter === "ALL") return counts.total;
  if (filter === "FAILED")
    return (
      counts.failures ?? (counts.counts.FAILED ?? 0) + (counts.counts.PARTIALLY_COMPLETED ?? 0)
    );
  return counts.counts[filter] ?? 0;
}

/**
 * The Broadcast tab, as the web app's broadcasts list: search with a status filter beside it, an overview,
 * what's sending right now, then each broadcast as a card. A card opens its results and history.
 */
function BroadcastsContent() {
  const dispatch = useAppDispatch();
  const { numbers } = useMessaging();
  // The list, its filter and search, and the counts live in the `broadcasts` slice.
  const list = useAppSelector(selectBroadcastsList);
  const rows = useAppSelector(selectBroadcastRows);
  const counts = useAppSelector(selectBroadcastCounts);
  // The workspace's tags, for the Tags filter and its chips.
  const tags = useAppSelector(selectBroadcastTags);
  const { filter, search, tagIds } = list;
  const loading = list.status === "idle" || list.status === "loading";
  // What's typed; the slice gets it once typing pauses.
  const [query, setQuery] = useState(search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Where the search row ends: the filter panel floats over the list from there.
  const [panelTop, setPanelTop] = useState(64);
  useEffect(() => {
    const timer = setTimeout(
      () => void dispatch(setBroadcastsQuery({ search: query.trim() })),
      300,
    );
    return () => clearTimeout(timer);
  }, [query, dispatch]);
  // Coming back (a broadcast paused or cancelled from its screen) re-reads it quietly.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadBroadcasts());
    }, [dispatch]),
  );
  // Live progress while one is sending: only the first page, and only in the foreground.
  const sending = rows.some((row) => row.status === "RUNNING");
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && list.page <= 1) void dispatch(loadBroadcasts());
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [sending, list.page, dispatch]);
  // The API's own "something changed", batched.
  const coalesce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent("campaigns.changed", () => {
    if (coalesce.current) clearTimeout(coalesce.current);
    coalesce.current = setTimeout(() => {
      coalesce.current = null;
      void dispatch(loadBroadcasts());
    }, 600);
  });
  useEffect(
    () => () => {
      if (coalesce.current) clearTimeout(coalesce.current);
    },
    [],
  );

  // "from …": the number that sent most in its latest run, by its internal session name.
  const fromNames = useMemo(
    () => new Map(numbers.map((number) => [number.sessionName, numberName(number)])),
    [numbers],
  );
  // A draft opens in the builder to finish it, as on the web; anything else opens its detail.
  const open = useCallback(
    (broadcast: Broadcast) =>
      broadcast.status === "DRAFT"
        ? router.push({
            pathname: "/new-broadcast",
            params: { id: broadcast.id },
          })
        : router.push({
            pathname: "/broadcast/[id]",
            params: { id: broadcast.id },
          }),
    [],
  );
  // A card's options, as the web app's row menu runs them; the thunks re-read the list after a change.
  const act = useCallback(
    async (broadcast: Broadcast, action: BroadcastCardAction): Promise<BroadcastActionResult> => {
      const failed = (result: { message?: string }, fallback: string) => ({
        error: result.message || fallback,
      });
      switch (action) {
        case "edit":
          router.push({
            pathname: "/new-broadcast",
            params: { id: broadcast.id },
          });
          return null;
        case "editMessage":
          router.push({
            pathname: "/edit-message",
            params: { id: broadcast.id },
          });
          return null;
        case "resume": {
          // Back to scheduled, continuing where it stopped.
          const result = await dispatch(resumeBroadcast(broadcast.id));
          return result.ok ? null : failed(result, "Couldn't resume sending. Try again.");
        }
        case "pause": {
          const result = await dispatch(pauseBroadcast(broadcast.id));
          return result.ok
            ? {
                // The web's words: a live send stops where it is; a scheduled one waits.
                notice:
                  broadcast.status === "RUNNING"
                    ? "Sending paused. Resume it to carry on where it stopped."
                    : "Paused. It won't send until you resume it.",
              }
            : failed(result, "Couldn't pause it. Try again.");
        }
        case "sendNow": {
          const result = await dispatch(sendBroadcastNow(broadcast.id));
          return result.ok
            ? { notice: "Sending starts in a few seconds" }
            : failed(result, "Couldn't send it now. Try again.");
        }
        case "duplicate": {
          const result = await dispatch(duplicateBroadcast(broadcast.id));
          return result.ok
            ? { notice: `Duplicated. “${result.data.name}” was saved as a draft.` }
            : failed(result, "Couldn't duplicate the broadcast. Try again.");
        }
        case "cancel":
        case "delete": {
          // Gone from the list once cancelled (or the draft deleted).
          const result = await dispatch(removeBroadcast(broadcast.id));
          return result.ok
            ? null
            : failed(
                result,
                action === "delete"
                  ? "Couldn't delete the draft. Try again."
                  : "Couldn't cancel the broadcast. Try again.",
              );
        }
      }
    },
    [dispatch],
  );
  const saveTags = useCallback(
    async (broadcast: Broadcast, tagIds: string[]) => {
      const result = await dispatch(updateBroadcastTags(broadcast.id, tagIds));
      return result.ok ? null : result.message || "Couldn't save the tags. Try again.";
    },
    [dispatch],
  );

  // A card's ⋯ menu, as the WhatsApp number cards': laid over the list under its button, closed by a tap
  // outside or a scroll. A picked form opens in the card; any other pick runs, its outcome shown on the card.
  // A sending broadcast has two cards (Live now and the list's): `from` keeps it all on the one used.
  const root = useRef<View>(null);
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    right: number;
    from: CardPlace;
  } | null>(null);
  const [panel, setPanel] = useState<{ id: string; kind: CardPanel; from: CardPlace } | null>(null);
  const [feedback, setFeedback] = useState<{
    id: string;
    text: string;
    error?: boolean;
    busy?: boolean;
    from: CardPlace;
  } | null>(null);
  const openMenu = useCallback((broadcast: Broadcast, button: View, from: CardPlace = "list") => {
    const screen = root.current;
    if (!screen) return;
    screen.measureInWindow((screenX, screenY, screenWidth, screenHeight) =>
      button.measureInWindow((x, y, width, height) => {
        const below = y - screenY + height + 2;
        const tall = menuHeight(broadcast);
        // Above the button when it wouldn't fit below.
        const top = below + tall > screenHeight - 12 ? Math.max(8, y - screenY - tall - 2) : below;
        setPanel(null);
        setFeedback(null);
        setMenu({
          id: broadcast.id,
          top,
          right: Math.max(8, screenX + screenWidth - (x + width)),
          from,
        });
      }),
    );
  }, []);
  const pick = async (broadcast: Broadcast, choice: BroadcastMenuPick, from: CardPlace) => {
    setMenu(null);
    const form = panelFor(choice);
    if (form) {
      setFeedback(null);
      setPanel({ id: broadcast.id, kind: form, from });
      return;
    }
    const action = choice as BroadcastCardAction;
    setPanel(null);
    const working = WORKING[action];
    setFeedback(working ? { id: broadcast.id, text: working, busy: true, from } : null);
    const result = await act(broadcast, action);
    setFeedback(
      !result
        ? null
        : "error" in result
          ? { id: broadcast.id, text: result.error, error: true, from }
          : { id: broadcast.id, text: result.notice, from },
    );
  };
  const confirm = useCallback(
    async (broadcast: Broadcast, action: "cancel" | "delete") => {
      const result = await act(broadcast, action);
      return result && "error" in result ? result.error : null;
    },
    [act],
  );
  const closePanel = useCallback(
    (broadcast: Broadcast, notice?: string, from: CardPlace = "list") => {
      setPanel(null);
      setFeedback(notice ? { id: broadcast.id, text: notice, from } : null);
    },
    [],
  );
  // The Live now cards' own way in, so their menu, form and outcome stay on them.
  const openLiveMenu = useCallback(
    (broadcast: Broadcast, button: View) => openMenu(broadcast, button, "live"),
    [openMenu],
  );
  const closeLivePanel = useCallback(
    (broadcast: Broadcast, notice?: string) => closePanel(broadcast, notice, "live"),
    [closePanel],
  );
  const cardState = useMemo(() => ({ menu, panel, feedback }), [menu, panel, feedback]);
  const setFilters = (next: BroadcastFilters) =>
    void dispatch(setBroadcastsQuery({ filter: next.status, tagIds: next.tagIds }));
  const openFilters = () => {
    if (!filtersOpen) void dispatch(loadTags());
    setFiltersOpen((open) => !open);
  };
  // Tag chips need the tags' names and colours once a tag filter is on.
  const tagFiltered = tagIds.length > 0;
  useEffect(() => {
    if (tagFiltered) void dispatch(loadTags());
  }, [tagFiltered, dispatch]);
  const refresh = () => void dispatch(loadBroadcasts("pull"));
  const filtered = filter !== "ALL" || tagFiltered || !!search;
  const live = filtered ? [] : rows.filter((row) => row.status === "RUNNING");
  // One card each: what is sending shows in Live now, so the list below leaves it out.
  const listed = live.length ? rows.filter((row) => row.status !== "RUNNING") : rows;
  const nothingYet = !loading && !list.error && !filtered && counts?.total === 0;

  if (nothingYet)
    return (
      <InboxState
        art={<BroadcastArt />}
        title="No broadcasts yet"
        action="New broadcast"
        actionIcon={Plus}
        onAction={() => router.push("/new-broadcast")}
      />
    );

  const header = (
    <View className="gap-5 pb-4 pt-1">
      {!filtered && <BroadcastsOverview counts={counts} />}
      <LiveNow
        broadcasts={live}
        onOpen={open}
        // The same ⋯ options as the running cards in the list.
        menu={{
          openId: menu?.from === "live" ? menu.id : null,
          panel: panel?.from === "live" ? panel : null,
          feedback: feedback?.from === "live" ? feedback : null,
          onMenu: openLiveMenu,
          onClosePanel: closeLivePanel,
          onConfirm: confirm,
          onSaveTags: saveTags,
        }}
      />
      {/* Only while searching: how many matched. The overview already gives the total. */}
      {!!search && !loading && rows.length > 0 && (
        <CustomText className="px-5 font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
          {`${plural(list.total, "result")} for “${search}”`.toUpperCase()}
        </CustomText>
      )}
    </View>
  );

  const menuBroadcast = menu && rows.find((row) => row.id === menu.id);
  return (
    <View ref={root} className="flex-1 bg-background">
      <View className="bg-card px-5 pb-3">
        {/* Search, with the filter button beside it; its panel floats over the list under them. */}
        <View
          className="flex-row items-center gap-2"
          onLayout={({ nativeEvent: { layout } }) => setPanelTop(layout.y + layout.height)}
        >
          <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-xl bg-accent px-3">
            <CustomIcon as={Search} size={20} className="text-muted-foreground" />
            <CustomInput
              accessibilityLabel="Search broadcasts"
              placeholder="Search broadcasts"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              size="xl"
              className="min-w-0 flex-1 border-0 bg-transparent px-1"
            />
            {!!query && (
              <MotionPressable
                role="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery("")}
                className="h-11 w-9 items-center justify-center"
              >
                <CustomIcon as={X} size={18} className="text-muted-foreground" />
              </MotionPressable>
            )}
          </View>
          <FilterButton
            active={filter !== "ALL" || tagFiltered}
            open={filtersOpen}
            onPress={openFilters}
          />
        </View>
        <ActiveFilters
          value={{ status: filter, tagIds }}
          tags={tags.items}
          count={chipCount(counts, filter)}
          onChange={setFilters}
        />
      </View>
      {list.error && (
        <View className="gap-1 px-5 py-3">
          <CustomAlert tone="error">{list.error}</CustomAlert>
          <CustomButton variant="link" onPress={refresh}>
            Try again
          </CustomButton>
        </View>
      )}
      <FlatList
        data={loading ? [] : listed}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        windowSize={7}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 12,
          paddingBottom: 40,
        }}
        refreshing={list.refreshing}
        onRefresh={refresh}
        onEndReached={() => void dispatch(loadBroadcasts("more"))}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <BroadcastCard
            broadcast={item}
            fromNumber={item.sessionName ? (fromNames.get(item.sessionName) ?? null) : null}
            onPress={() => open(item)}
            menuOpen={menu?.from === "list" && menu.id === item.id}
            panel={panel?.from === "list" && panel.id === item.id ? panel.kind : null}
            feedback={feedback?.from === "list" && feedback.id === item.id ? feedback : null}
            onMenu={openMenu}
            onClosePanel={closePanel}
            onConfirm={confirm}
            onAction={act}
            onSaveTags={saveTags}
          />
        )}
        extraData={cardState}
        // A scroll moves the cards out from under the open menu: it closes.
        onScrollBeginDrag={() => setMenu(null)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <BroadcastsSkeleton />
          ) : list.error || live.length ? null : (
            <InboxState
              icon={SearchX}
              title={search ? `No broadcasts match “${search}”` : "No broadcasts here"}
              description={
                search
                  ? "Try a different name, or clear the filters."
                  : "Broadcasts matching these filters will show here."
              }
              action="Show all broadcasts"
              onAction={() => {
                setQuery("");
                setFilters({ status: "ALL", tagIds: [] });
              }}
            />
          )
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View className="items-center p-4">
              <CustomSpinner accessibilityLabel="Loading more broadcasts" />
            </View>
          ) : null
        }
      />
      {/* New broadcast, as the chat list's New chat button. */}
      <MotionPressable
        role="button"
        accessibilityLabel="New broadcast"
        onPress={() => router.push("/new-broadcast")}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-black/20"
      >
        <CustomIcon as={Plus} size={26} className="text-primary-foreground" />
      </MotionPressable>
      {/* The filter panel over the list, so nothing under it moves; a tap outside closes it. */}
      {filtersOpen && (
        <>
          <Pressable
            accessibilityLabel="Close filters"
            onPress={() => setFiltersOpen(false)}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              top: panelTop,
              backgroundColor: "rgba(0,0,0,0.18)",
            }}
          />
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", left: 20, right: 20, top: panelTop }}
          >
            <FilterPanel
              value={{ status: filter, tagIds }}
              tags={tags.items}
              tagsError={tags.error}
              counts={(item) => chipCount(counts, item)}
              onRetryTags={() => void dispatch(loadTags(true))}
              onApply={(next) => {
                setFilters(next);
                setFiltersOpen(false);
              }}
            />
          </View>
        </>
      )}
      {menu && menuBroadcast && (
        <>
          {/* Tapping anywhere outside the menu closes it, without also pressing what's underneath. */}
          <Pressable
            accessibilityLabel="Close options"
            onPress={() => setMenu(null)}
            className="absolute inset-0 z-10"
          />
          <BroadcastMenu
            broadcast={menuBroadcast}
            top={menu.top}
            right={menu.right}
            onPick={(choice) => void pick(menuBroadcast, choice, menu.from)}
          />
        </>
      )}
    </View>
  );
}

/** Which card a sending broadcast's menu was opened from: Live now's, or the list's. */
type CardPlace = "live" | "list";

/** What a card says while a picked action runs. */
const WORKING: Partial<Record<BroadcastCardAction, string>> = {
  resume: "Resuming…",
  pause: "Pausing…",
  sendNow: "Sending now…",
  duplicate: "Duplicating…",
  delete: "Deleting…",
};

/** The cards' shapes while the first page loads, so nothing jumps when they arrive. */
function BroadcastsSkeleton() {
  return (
    <Pulse>
      <View
        accessibilityLabel="Loading broadcasts"
        accessibilityState={{ busy: true }}
        className="gap-3"
      >
        {[0, 1, 2].map((key) => (
          <View key={key} className="mx-4 gap-4 rounded-3xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 rounded-2xl bg-muted" />
              <View className="flex-1 gap-2">
                <View className="h-3.5 w-1/2 rounded bg-muted" />
                <View className="h-3 w-3/4 rounded bg-muted" />
              </View>
            </View>
            <View className="h-1.5 rounded-full bg-muted" />
            <View className="flex-row gap-3">
              {[0, 1, 2].map((cell) => (
                <View key={cell} className="h-8 flex-1 rounded-lg bg-muted" />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Pulse>
  );
}
