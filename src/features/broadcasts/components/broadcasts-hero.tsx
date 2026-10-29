import { Ellipsis } from "lucide-react-native";
import { useRef } from "react";
import { ScrollView, View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { PulseHalo } from "@/features/messaging/components/connection-pulse";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { STATUS } from "../constants";
import type { Broadcast } from "../types";
import { formatCount, percent, plannedOf } from "../utils/broadcast-format";
import { CardPanelView, type CardPanel } from "./broadcast-actions";
import { ProgressBar } from "./broadcast-parts";

/** The ⋯ options of the Live now cards: the same menu, forms and outcome line as the list's cards. */
export interface LiveNowMenu {
  /** The broadcast whose menu is open, the form open in its card, and what came of a pick. */
  openId: string | null;
  panel: { id: string; kind: CardPanel } | null;
  feedback: { id: string; text: string; error?: boolean; busy?: boolean } | null;
  onMenu: (broadcast: Broadcast, button: View) => void;
  onClosePanel: (broadcast: Broadcast, notice?: string) => void;
  onConfirm: (broadcast: Broadcast, action: "cancel" | "delete") => Promise<string | null>;
  onSaveTags: (broadcast: Broadcast, tagIds: string[]) => Promise<string | null>;
}

/** Broadcasts going out right now, each with its live progress; side by side when there are several. */
export function LiveNow({
  broadcasts,
  onOpen,
  menu,
}: {
  broadcasts: Broadcast[];
  onOpen: (broadcast: Broadcast) => void;
  menu?: LiveNowMenu;
}) {
  if (!broadcasts.length) return null;
  const single = broadcasts.length === 1;
  const cards = broadcasts.map((broadcast) => (
    <LiveCard
      key={broadcast.id}
      broadcast={broadcast}
      single={single}
      onOpen={onOpen}
      menu={menu}
    />
  ));
  return (
    <View className="gap-2.5">
      <CustomText className="px-5 font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
        LIVE NOW
      </CustomText>
      {single ? (
        <View className="px-4">{cards}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-4"
        >
          {cards}
        </ScrollView>
      )}
    </View>
  );
}

function LiveCard({
  broadcast,
  single,
  onOpen,
  menu,
}: {
  broadcast: Broadcast;
  single: boolean;
  onOpen: (broadcast: Broadcast) => void;
  menu?: LiveNowMenu;
}) {
  const { colors } = useRokloTheme();
  const menuButton = useRef<View>(null);
  const total = plannedOf(broadcast);
  const menuOpen = menu?.openId === broadcast.id;
  const panel = menu?.panel?.id === broadcast.id ? menu.panel.kind : null;
  const feedback = menu?.feedback?.id === broadcast.id ? menu.feedback : null;
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={`${broadcast.name}, sending, ${percent(broadcast.sent, total) || "starting"}`}
      onPress={() => onOpen(broadcast)}
      className="overflow-hidden rounded-3xl border border-brand-200 bg-brand-50 active:opacity-90"
      style={single ? undefined : { width: 280 }}
    >
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-2">
          <PulseHalo size={8} color={colors.primary}>
            <View className="h-2 w-2 rounded-full bg-primary" />
          </PulseHalo>
          <CustomText className="flex-1 font-sans-semibold text-[11px] tracking-[0.4px] text-brand-700">
            SENDING NOW
          </CustomText>
          {/* Its options, as the list's cards: laid over the list by the screen. */}
          {menu && (
            <MotionPressable
              ref={menuButton}
              role="button"
              accessibilityLabel={`Options for ${broadcast.name}`}
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => {
                if (menuButton.current) menu.onMenu(broadcast, menuButton.current);
              }}
              className={cn(
                "-my-2 -mr-2 h-10 w-10 items-center justify-center rounded-full",
                menuOpen ? "bg-brand-100" : "active:bg-brand-100",
              )}
            >
              <CustomIcon as={Ellipsis} size={20} className="text-brand-700" />
            </MotionPressable>
          )}
        </View>
        <View className="flex-row items-end justify-between gap-3">
          <CustomText numberOfLines={1} className="min-w-0 flex-1 font-sans-semibold text-base">
            {broadcast.name}
          </CustomText>
          <CustomText className="font-sans-semibold text-2xl leading-7 tracking-[-0.5px] text-brand-700">
            {percent(broadcast.sent, total) || "0%"}
          </CustomText>
        </View>
        <ProgressBar
          sent={broadcast.sent}
          failed={broadcast.failed}
          total={total}
          barClass={STATUS.RUNNING.bar}
          live
          height={8}
          label={`${broadcast.name} progress`}
        />
        <CustomText className="text-xs text-ink-600">
          {formatCount(broadcast.sent)} of {formatCount(total)} sent
          {broadcast.failed ? ` · ${formatCount(broadcast.failed)} failed` : ""}
          {broadcast.stuckDueToCapAt ? " · waiting for daily limit" : ""}
        </CustomText>
        {/* What came of an option picked from the menu. */}
        {feedback && (
          <View role={feedback.error ? "alert" : "status"} className="flex-row items-center gap-2">
            {feedback.busy && <CustomSpinner size="small" />}
            <CustomText
              className={cn(
                "flex-1 text-xs",
                feedback.error
                  ? "text-error-fg"
                  : feedback.busy
                    ? "text-muted-foreground"
                    : "text-success-fg",
              )}
            >
              {feedback.text}
            </CustomText>
          </View>
        )}
      </View>
      {panel && menu && (
        <CardPanelView
          broadcast={broadcast}
          panel={panel}
          onConfirm={(action) => menu.onConfirm(broadcast, action)}
          onSaveTags={menu.onSaveTags}
          onClose={(notice) => menu.onClosePanel(broadcast, notice)}
        />
      )}
    </MotionPressable>
  );
}
