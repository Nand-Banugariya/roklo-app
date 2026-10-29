import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { Pulse } from "@/features/messaging/components/inbox-state";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { cn } from "@/lib/utils";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  CalendarClock,
  CalendarX2,
  CircleX,
  Copy,
  FileText,
  Hourglass,
  MessageSquareReply,
  Pause,
  Pencil,
  Play,
  Repeat,
  Send,
  SendHorizontal,
  Trash2,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { StatTile, StatusPill } from "../components/broadcast-parts";
import { ProgressRing } from "../components/progress-ring";
import { RunCard } from "../components/run-card";
import { STATUS } from "../constants";
import { outcomeStatus } from "../services/broadcasts-api";
import {
  duplicateBroadcast,
  loadBroadcast,
  loadOlderRuns,
  pauseBroadcast,
  removeBroadcast,
  resumeBroadcast,
  sendBroadcastNow,
} from "../services/broadcasts-service";
import {
  selectBroadcastDetail,
  selectBroadcastRow,
  selectRuns,
} from "../store/broadcasts-selectors";
import type { BroadcastStatus } from "../types";
import {
  formatCount,
  formatWhen,
  isFinished,
  isRepeatEnded,
  percent,
  repeatLabel,
} from "../utils/broadcast-format";

type Confirm = "cancel" | "delete";
/** The web app's wording for each confirmation, shown inline (no dialogs on signed-in screens). */
const CONFIRM: Record<
  Confirm,
  {
    title: (name: string) => string;
    body: string;
    confirm: string;
    keep: string;
  }
> = {
  delete: {
    title: (name) => `Delete “${name}”?`,
    body: "The draft is removed. This can't be undone.",
    confirm: "Delete draft",
    keep: "Keep draft",
  },
  cancel: {
    title: (name) => `Cancel “${name}”?`,
    body: "Messages not sent yet won't go out, and it's removed from your broadcasts. Messages already sent stay delivered.",
    confirm: "Cancel broadcast",
    keep: "Keep it",
  },
};

/**
 * One broadcast: where it stands (a progress ring and its results), what can be done with it now, and each
 * send it has made. Its numbers come from the list it was opened from, or add up its runs.
 */
export function BroadcastScreen() {
  // `section=runs` (View runs on a card): opens scrolled to its sends.
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const scroller = useRef<ScrollView>(null);
  const jumped = useRef(false);
  const toRuns = (y: number) => {
    if (section !== "runs" || jumped.current) return;
    jumped.current = true;
    scroller.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };
  const dispatch = useAppDispatch();
  // This broadcast in the `broadcasts` slice: its list row (when the list has it), summary and runs.
  const row = useAppSelector((state) => selectBroadcastRow(state, id));
  const detail = useAppSelector((state) => selectBroadcastDetail(state, id));
  const runsById = useAppSelector(selectRuns);
  const summary = detail?.summary ?? null;
  const error = detail?.status === "error" ? detail.error : null;
  const runIds = detail?.runIds;
  const runs = useMemo(
    () => (runIds ?? []).flatMap((runId) => (runsById[runId] ? [runsById[runId]] : [])),
    [runIds, runsById],
  );
  const runTotal = detail?.runTotal ?? 0;
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);

  // Opened before the workspace is known (from a notification), it loads once the workspace arrives.
  const workspaceId = useAppSelector(selectActiveWorkspace)?.id;
  const load = useCallback(
    () => dispatch(loadBroadcast(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, id, workspaceId],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function pull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Results: the list's totals when it was opened from there, else the loaded runs added up.
  const fromRuns = runs.reduce(
    (sum, run) => ({
      sent: sum.sent + run.sent,
      failed: sum.failed + run.failed,
      replied: sum.replied + run.replied,
      total: sum.total + run.total,
    }),
    { sent: 0, failed: 0, replied: 0, total: 0 },
  );
  const sent = row?.sent ?? fromRuns.sent;
  const failed = Math.max(row?.failed ?? 0, summary?.failed ?? 0, fromRuns.failed);
  const replied = row?.replied ?? fromRuns.replied;
  const delivered = row?.delivered ?? null;
  const planned = row?.targets || fromRuns.total || summary?.totalRecipients || 0;
  const status: BroadcastStatus | null = summary
    ? outcomeStatus(summary.status, sent, failed)
    : null;

  async function act(
    key: string,
    action: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
    after?: () => void,
  ) {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setNotice({
        text: result.message || "Something went wrong. Try again.",
        error: true,
      });
      return;
    }
    setConfirm(null);
    if (after) {
      after();
      return;
    }
    // The thunk re-reads the list and this broadcast after a change.
    setNotice({ text: success });
  }

  if (error)
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Broadcast" />
        <View className="gap-2 p-5">
          <CustomAlert tone="error">{error}</CustomAlert>
          <CustomButton variant="link" onPress={() => void load()}>
            Try again
          </CustomButton>
        </View>
      </View>
    );
  if (!summary || !status)
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Broadcast" />
        <BroadcastSkeleton />
      </View>
    );

  const style = STATUS[status];
  const repeat = repeatLabel(summary.repeat, summary.scheduledAt);
  const ended = isRepeatEnded(summary.repeat);
  const next =
    summary.status === "SCHEDULED" || summary.status === "PAUSED"
      ? formatWhen(summary.nextScheduledAt, { weekday: true })
      : "";
  const lastSent = runs[0]?.startedAt
    ? formatWhen(runs[0].startedAt, { weekday: true })
    : row?.lastSentAt
      ? formatWhen(row.lastSentAt, { weekday: true })
      : "";
  const queued = Math.max(0, planned - sent - failed);
  const copy = confirm ? CONFIRM[confirm] : null;

  // What can be done in this status, as the web app's row menu (a draft's Edit opens the builder; editing
  // a scheduled one and the report stay on the web).
  type ActionKey = "edit" | "send" | "pause" | "resume" | "duplicate" | "cancel" | "delete";
  const ACTION: Record<
    ActionKey,
    {
      label: string;
      icon: LucideIcon;
      variant: "primary" | "secondary" | "destructive";
    }
  > = {
    edit: { label: "Edit", icon: Pencil, variant: "primary" },
    send: { label: "Send now", icon: SendHorizontal, variant: "primary" },
    pause: {
      label: summary.status === "RUNNING" ? "Pause sending" : "Pause",
      icon: Pause,
      variant: "secondary",
    },
    resume: { label: "Resume sending", icon: Play, variant: "primary" },
    duplicate: { label: "Duplicate", icon: Copy, variant: "secondary" },
    cancel: { label: "Cancel", icon: CircleX, variant: "destructive" },
    delete: { label: "Delete", icon: Trash2, variant: "destructive" },
  };
  const keys: ActionKey[] =
    summary.status === "DRAFT"
      ? ["edit", "duplicate", "delete"]
      : // Moving a repeating broadcast's start would shift its whole series.
        summary.status === "SCHEDULED"
        ? [
            ...(summary.repeat.type === "NONE" ? ["send" as const] : []),
            "pause",
            "duplicate",
            "cancel",
          ]
        : summary.status === "PAUSED"
          ? ["resume", "cancel"]
          : summary.status === "RUNNING"
            ? ["pause", "duplicate"]
            : ["duplicate"];
  function handle(key: ActionKey) {
    switch (key) {
      case "edit":
        return void router.push({
          pathname: "/new-broadcast",
          params: { id },
        });
      case "send":
        return void act(
          key,
          () => dispatch(sendBroadcastNow(id)),
          "Sending starts in a few seconds",
        );
      case "pause":
        return void act(
          key,
          () => dispatch(pauseBroadcast(id)),
          summary!.status === "SCHEDULED"
            ? "Broadcast paused. It won't send until you resume it."
            : "Sending paused",
        );
      case "resume":
        return void act(key, () => dispatch(resumeBroadcast(id)), "Sending resumed");
      case "duplicate":
        return void act(
          key,
          async () => {
            const result = await dispatch(duplicateBroadcast(id));
            if (result.ok)
              setNotice({
                text: `Duplicated. “${result.data.name}” was saved as a draft.`,
              });
            return result;
          },
          "",
          () => undefined,
        );
      default:
        setConfirm(key);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={summary.name} subtitle={style.label} />
      <ScrollView
        ref={scroller}
        contentContainerClassName="gap-4 p-4 pb-12"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pull()} />}
      >
        {/* Where it stands: its status, schedule and a ring of how much has gone out. */}
        <View className="gap-5 rounded-[28px] border border-border bg-card p-5 shadow-sm shadow-black/5">
          <View className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusPill status={style} />
              {!!repeat && status !== "COMPLETED" && (
                <View className="h-6 flex-row items-center gap-1 rounded-full bg-accent px-2.5">
                  <CustomIcon as={Repeat} size={11} className="text-ink-700" />
                  <CustomText className="font-sans-medium text-[11px] text-ink-700">
                    {repeat}
                  </CustomText>
                </View>
              )}
            </View>
            <CustomText
              role="heading"
              className="font-sans-semibold text-[22px] leading-7 tracking-[-0.4px]"
            >
              {summary.name}
            </CustomText>
          </View>
          <View className="flex-row items-center gap-5">
            <ProgressRing sent={sent} failed={failed} total={planned} />
            <View className="min-w-0 flex-1 gap-2.5">
              <Legend dot="bg-primary" label="Sent" value={formatCount(sent)} />
              <Legend dot="bg-error-solid" label="Failed" value={formatCount(failed)} />
              <Legend dot="bg-ink-300" label="Still to send" value={formatCount(queued)} />
              <Legend
                icon={UsersRound}
                label="Audience"
                value={formatCount(summary.totalRecipients)}
              />
            </View>
          </View>
          <View className="gap-2 border-t border-border pt-4">
            {!!next && <Line icon={CalendarClock} label="Next send" value={next} strong />}
            {!!lastSent && <Line icon={Send} label="Last sent" value={lastSent} />}
            {!!summary.templateName && (
              <Line icon={FileText} label="Template" value={summary.templateName} />
            )}
            <Line icon={CalendarClock} label="Created" value={formatWhen(summary.createdAt)} />
          </View>
        </View>

        {ended && summary.status === "PAUSED" && (
          <CustomAlert tone="warning" icon={CalendarX2} title="Its end date has passed">
            It stays paused so nothing goes out past its end. To keep it going, set a later end date
            on the web.
          </CustomAlert>
        )}
        {summary.stuckDueToCapAt && (
          <CustomAlert tone="error" title="Waiting for the daily limit">
            {"Sending continues when the number's daily limit resets."}
          </CustomAlert>
        )}

        {/* Results across every send. */}
        {sent > 0 && (
          <View className="gap-2.5">
            <CustomText className="px-1 font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
              PERFORMANCE
            </CustomText>
            <View className="flex-row flex-wrap gap-2.5">
              <StatTile
                icon={Send}
                label="Sent"
                value={formatCount(sent)}
                caption={percent(sent, planned)}
                tint="bg-brand-100"
              />
              <StatTile
                icon={TriangleAlert}
                label="Failed"
                value={formatCount(failed)}
                caption={failed ? percent(failed, planned) : undefined}
                tint="bg-error-bg-2"
              />
              <StatTile
                icon={CalendarClock}
                label="Delivered"
                value={delivered === null ? "—" : formatCount(delivered)}
                caption={delivered ? percent(delivered, sent) : undefined}
                tint="bg-info-bg"
              />
              <StatTile
                icon={MessageSquareReply}
                label="Replied"
                value={formatCount(replied)}
                caption={replied ? percent(replied, sent) : undefined}
                tint="bg-purple-tint"
              />
            </View>
          </View>
        )}

        {/* What can be done now; Cancel and Delete ask first, here rather than in a dialog. Not shown once
            it has finished. */}
        {!isFinished(status) && (
          <View className="gap-3 rounded-3xl border border-border bg-card p-4">
            <View className="flex-row flex-wrap gap-2">
              {keys
                .map((key) => ({
                  key,
                  ...ACTION[key],
                  disabled: key === "resume" && ended,
                }))
                .map((action) => (
                  <CustomButton
                    key={action.key}
                    size="sm"
                    variant={action.variant === "destructive" ? "outline" : action.variant}
                    disabled={action.disabled || (!!busy && busy !== action.key)}
                    loading={busy === action.key}
                    onPress={() => handle(action.key)}
                    className={cn(
                      "grow",
                      action.variant === "destructive" && "border-error-border",
                    )}
                    leadingIcon={
                      <CustomIcon
                        as={action.icon}
                        size={15}
                        className={
                          action.variant === "primary"
                            ? "text-primary-foreground"
                            : action.variant === "destructive"
                              ? "text-error-fg"
                              : "text-foreground"
                        }
                      />
                    }
                  >
                    {action.variant === "destructive" ? (
                      <CustomText className="font-sans-semibold text-sm text-error-fg">
                        {action.label}
                      </CustomText>
                    ) : (
                      action.label
                    )}
                  </CustomButton>
                ))}
            </View>
            {ended && summary.status === "PAUSED" && (
              <View className="flex-row items-center gap-1.5">
                <CustomIcon as={CalendarX2} size={13} className="text-warning-fg" />
                <CustomText className="text-xs text-warning-fg">
                  {"Can't resume: its end date has passed."}
                </CustomText>
              </View>
            )}
            {copy && (
              <View
                role="alert"
                className="gap-2 rounded-2xl border border-error-border bg-error-bg p-3.5"
              >
                <CustomText className="font-sans-semibold text-sm text-error-fg">
                  {copy.title(summary.name)}
                </CustomText>
                <CustomText className="text-xs leading-5 text-error-fg">{copy.body}</CustomText>
                <View className="flex-row gap-2 pt-1">
                  <CustomButton
                    size="sm"
                    variant="destructive-solid"
                    loading={busy === "remove"}
                    onPress={() =>
                      void act(
                        "remove",
                        () => dispatch(removeBroadcast(id)),
                        "",
                        () => router.back(),
                      )
                    }
                  >
                    {copy.confirm}
                  </CustomButton>
                  <CustomButton
                    size="sm"
                    variant="ghost"
                    disabled={busy === "remove"}
                    onPress={() => setConfirm(null)}
                  >
                    {copy.keep}
                  </CustomButton>
                </View>
              </View>
            )}
            {notice && (
              <CustomText
                role={notice.error ? "alert" : "status"}
                className={cn("text-xs", notice.error ? "text-error-fg" : "text-success-fg")}
              >
                {notice.text}
              </CustomText>
            )}
            {summary.status !== "DRAFT" && (
              <CustomText className="text-[11px] leading-4 text-muted-foreground">
                To change the audience or schedule, open this broadcast in Roklo on the web.
              </CustomText>
            )}
          </View>
        )}

        {/* Every send it has made; a repeating broadcast has one per occurrence. */}
        <View className="gap-2.5" onLayout={({ nativeEvent }) => toRuns(nativeEvent.layout.y)}>
          <View className="flex-row items-center justify-between px-1">
            <CustomText className="font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
              SENDS
            </CustomText>
            {runTotal > 0 && (
              <CustomText className="font-sans-medium text-[11px] text-muted-foreground">
                {formatCount(runTotal)} {runTotal === 1 ? "run" : "runs"}
              </CustomText>
            )}
          </View>
          {runs.length ? (
            runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                broadcastId={id}
                hasGroupTargets={summary.hasGroupTargets}
              />
            ))
          ) : (
            <View className="items-center gap-1 rounded-3xl border border-dashed border-border px-4 py-6">
              <CustomIcon as={Hourglass} size={20} className="text-ink-400" />
              <CustomText className="text-center text-sm text-muted-foreground">
                {summary.status === "DRAFT"
                  ? "Nothing has gone out yet. Tap Edit to finish it and schedule it."
                  : "Nothing has gone out yet. Its sends will show here."}
              </CustomText>
            </View>
          )}
          {runs.length < runTotal && (
            <CustomButton
              variant="ghost"
              loading={!!detail?.loadingRuns}
              onPress={() => void dispatch(loadOlderRuns(id))}
            >
              Show older runs
            </CustomButton>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Legend({
  dot,
  icon,
  label,
  value,
}: {
  dot?: string;
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      {icon ? (
        <CustomIcon as={icon} size={12} className="text-muted-foreground" />
      ) : (
        <View className={cn("h-2.5 w-2.5 rounded-full", dot)} />
      )}
      <CustomText className="flex-1 text-xs text-muted-foreground">{label}</CustomText>
      <CustomText className="font-sans-semibold text-[13px]">{value}</CustomText>
    </View>
  );
}

function Line({
  icon,
  label,
  value,
  strong,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <CustomIcon as={icon} size={14} className="text-muted-foreground" />
      <CustomText className="w-[84px] text-xs text-muted-foreground">{label}</CustomText>
      <CustomText
        numberOfLines={1}
        className={cn(
          "min-w-0 flex-1 text-[13px]",
          strong ? "font-sans-semibold text-foreground" : "text-ink-700",
        )}
      >
        {value}
      </CustomText>
    </View>
  );
}

/**
 * The page's own shape while it loads: the status card (pill, name, the ring and its legend, the send
 * details), the performance tiles, the actions and the sends, so nothing jumps when it arrives.
 */
function BroadcastSkeleton() {
  return (
    <View className="flex-1 overflow-hidden">
      <Pulse>
        <View
          accessibilityLabel="Loading the broadcast"
          accessibilityState={{ busy: true }}
          className="gap-4 p-4"
        >
          <View className="gap-5 rounded-[28px] border border-border bg-card p-5">
            <View className="gap-2.5">
              <View className="flex-row gap-2">
                <View className="h-6 w-24 rounded-full bg-muted" />
                <View className="h-6 w-20 rounded-full bg-muted" />
              </View>
              <View className="h-6 w-3/4 rounded-md bg-muted" />
            </View>
            <View className="flex-row items-center gap-5">
              {/* The progress ring, as a ring. */}
              <View className="h-[132px] w-[132px] rounded-full border-[12px] border-muted" />
              <View className="min-w-0 flex-1 gap-3.5">
                {[0, 1, 2, 3].map((row) => (
                  <View key={row} className="flex-row items-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full bg-muted" />
                    <View className="h-3 flex-1 rounded bg-muted" />
                    <View className="h-3 w-8 rounded bg-muted" />
                  </View>
                ))}
              </View>
            </View>
            <View className="gap-3 border-t border-border pt-4">
              {["w-2/3", "w-1/2", "w-3/5"].map((width) => (
                <View key={width} className="flex-row items-center gap-2.5">
                  <View className="h-3.5 w-3.5 rounded bg-muted" />
                  <View className="h-3 w-[84px] rounded bg-muted" />
                  <View className={cn("h-3 rounded bg-muted", width)} />
                </View>
              ))}
            </View>
          </View>

          <View className="gap-2.5">
            <View className="mx-1 h-3 w-24 rounded bg-muted" />
            <View className="flex-row flex-wrap gap-2.5">
              {[0, 1, 2, 3].map((tile) => (
                <View
                  key={tile}
                  className="min-w-[46%] flex-1 gap-2.5 rounded-2xl border border-border bg-card p-3.5"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="h-7 w-7 rounded-lg bg-muted" />
                    <View className="h-3 w-14 rounded bg-muted" />
                  </View>
                  <View className="h-5 w-16 rounded bg-muted" />
                </View>
              ))}
            </View>
          </View>

          <View className="flex-row gap-2 rounded-3xl border border-border bg-card p-4">
            {[0, 1, 2].map((button) => (
              <View key={button} className="h-9 flex-1 rounded-md bg-muted" />
            ))}
          </View>

          <View className="gap-2.5">
            <View className="mx-1 h-3 w-16 rounded bg-muted" />
            {[0, 1].map((run) => (
              <View key={run} className="gap-3 rounded-3xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2">
                  <View className="h-4 w-20 rounded bg-muted" />
                  <View className="h-5 w-16 rounded-full bg-muted" />
                </View>
                <View className="h-1.5 rounded-full bg-muted" />
              </View>
            ))}
          </View>
        </View>
      </Pulse>
    </View>
  );
}
