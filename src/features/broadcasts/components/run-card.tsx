import { ChevronDown, Hourglass, PauseCircle } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { RUN_STATUS } from "../constants";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadRun } from "../services/broadcasts-service";
import { selectRunDetail } from "../store/broadcasts-selectors";
import type { BroadcastRun } from "../types";
import {
  formatCount,
  formatWhen,
  pauseReasonLabel,
  percent,
  REPLY_RATE,
  replyRate,
  runDuration,
} from "../utils/broadcast-format";
import { ProgressBar, StatusPill } from "./broadcast-parts";

const FINISHED = ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELED"];

/**
 * One send of a broadcast: its status, progress and results. Tapped, it reads the run's delivered and read
 * counts (only a single run has them) and shows how far its messages got: sent → delivered → read → replied.
 */
export function RunCard({
  run,
  broadcastId,
  hasGroupTargets,
}: {
  run: BroadcastRun;
  broadcastId: string;
  hasGroupTargets: boolean;
}) {
  const dispatch = useAppDispatch();
  const status = RUN_STATUS[run.status];
  const [open, setOpen] = useState(false);
  // Its single read in the slice; once read, `run` itself carries the delivered and read counts.
  const detail = useAppSelector((state) => selectRunDetail(state, run.id));
  const loading = detail?.status === "loading";
  const error = detail?.status === "error" ? detail.error : null;
  const rate = replyRate(run);
  const finished = FINISHED.includes(run.status);
  const duration = runDuration(run);
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && detail?.status !== "ready" && !loading) void dispatch(loadRun(broadcastId, run.id));
  }
  const shown = run;
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <MotionPressable
        role="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Batch ${run.runNumber}, ${status.label}. ${open ? "Hide" : "Show"} its results`}
        onPress={toggle}
        className="gap-3 p-4 active:bg-accent"
      >
        <View className="flex-row items-center gap-2">
          <CustomText className="font-sans-semibold text-[15px]">Batch #{run.runNumber}</CustomText>
          <StatusPill status={status} size="sm" />
          <View className="flex-1" />
          <CustomIcon
            as={ChevronDown}
            size={16}
            className={cn("text-ink-400", open && "rotate-180")}
          />
        </View>
        <CustomText className="text-xs text-muted-foreground">
          {run.startedAt
            ? `Started ${formatWhen(run.startedAt, { weekday: true })}`
            : `Queued ${formatWhen(run.createdAt, { weekday: true })}`}
          {duration ? ` · ${finished ? "took" : "running for"} ${duration}` : ""}
        </CustomText>
        <ProgressBar
          sent={run.sent}
          failed={run.failed}
          total={run.total}
          barClass={status.bar}
          live={run.status === "RUNNING"}
          label={`Batch ${run.runNumber} progress`}
        />
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <CustomText className="text-xs text-ink-700">
            <CustomText className="font-sans-semibold text-xs">{formatCount(run.sent)}</CustomText>{" "}
            of {formatCount(run.total)} sent
          </CustomText>
          {run.failed > 0 && (
            <CustomText className="font-sans-medium text-xs text-error-fg">
              {formatCount(run.failed)} failed
            </CustomText>
          )}
          <CustomText className="text-xs text-ink-700">
            <CustomText className="font-sans-semibold text-xs">
              {formatCount(run.replied)}
            </CustomText>{" "}
            {run.replied === 1 ? "reply" : "replies"}
          </CustomText>
          {rate !== null && (
            <View
              className={cn(
                "rounded-full px-2 py-0.5",
                rate >= REPLY_RATE.healthy
                  ? "bg-success-bg"
                  : rate >= REPLY_RATE.floor
                    ? "bg-warning-tint"
                    : "bg-error-bg-2",
              )}
            >
              <CustomText
                className={cn(
                  "font-sans-semibold text-[10px]",
                  rate >= REPLY_RATE.healthy
                    ? "text-success-fg"
                    : rate >= REPLY_RATE.floor
                      ? "text-warning-fg"
                      : "text-error-strong",
                )}
              >
                {Math.round(rate * 100)}% reply rate
              </CustomText>
            </View>
          )}
        </View>
        {run.status === "PAUSED" && (
          <Note icon={PauseCircle} tone="text-warning-fg" text={pauseReasonLabel(run)} />
        )}
        {run.stuckDueToCapAt && (
          <Note icon={Hourglass} tone="text-error-fg" text="Waiting for the daily limit to reset" />
        )}
      </MotionPressable>

      {open && (
        <View className="gap-3 border-t border-border bg-background p-4">
          {loading ? (
            <View className="items-center py-3">
              <CustomSpinner accessibilityLabel="Loading this run" />
            </View>
          ) : error ? (
            <CustomText className="text-xs text-error-fg">{error}</CustomText>
          ) : (
            <>
              <CustomText className="font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
                HOW FAR IT GOT
              </CustomText>
              <Funnel label="Sent" value={shown.sent} of={shown.sent} bar="bg-brand-600" />
              <Funnel
                label="Delivered"
                value={shown.delivered}
                of={shown.sent}
                bar="bg-brand-500"
              />
              <Funnel label="Read" value={shown.read} of={shown.sent} bar="bg-info-solid" />
              <Funnel
                label="Replied"
                value={shown.replied}
                of={shown.sent}
                bar="bg-purple-accent"
              />
              {hasGroupTargets && (
                <CustomText className="text-[11px] leading-4 text-muted-foreground">
                  {
                    "Includes WhatsApp groups, which don't report deliveries or reads: Delivered and Read count individual chats only."
                  }
                </CustomText>
              )}
              <View className="flex-row flex-wrap gap-y-2 pt-1">
                <Detail label="Recipients" value={formatCount(shown.total)} />
                <Detail label="Pending" value={formatCount(shown.pending)} />
                <Detail
                  label="Finished"
                  value={
                    shown.completedAt ? formatWhen(shown.completedAt) : finished ? "—" : "Not yet"
                  }
                />
                <Detail
                  label={finished ? "Took" : "Running for"}
                  value={runDuration(shown) ?? "—"}
                />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** One step of the funnel: its share of what was sent, as a bar. */
function Funnel({
  label,
  value,
  of,
  bar,
}: {
  label: string;
  value: number | null;
  of: number;
  bar: string;
}) {
  const share = value !== null && of > 0 ? Math.min(1, value / of) : 0;
  return (
    <View
      className="gap-1.5"
      accessibilityLabel={`${label}: ${value === null ? "not reported" : `${formatCount(value)}${of ? `, ${percent(value, of)}` : ""}`}`}
    >
      <View className="flex-row items-baseline justify-between">
        <CustomText className="text-xs text-ink-700">{label}</CustomText>
        <CustomText className="font-sans-semibold text-xs">
          {value === null ? "—" : formatCount(value)}
          {value !== null && of > 0 && (
            <CustomText className="font-sans-medium text-[11px] text-muted-foreground">
              {" "}
              {percent(value, of)}
            </CustomText>
          )}
        </CustomText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-ink-150">
        <View className={cn("h-full rounded-full", bar)} style={{ width: `${share * 100}%` }} />
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 gap-0.5 pr-2">
      <CustomText className="text-[11px] text-muted-foreground">{label}</CustomText>
      <CustomText className="font-sans-medium text-[13px]">{value}</CustomText>
    </View>
  );
}

function Note({ icon, tone, text }: { icon: typeof Hourglass; tone: string; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <CustomIcon as={icon} size={13} className={tone} />
      <CustomText className={cn("font-sans-medium text-xs", tone)}>{text}</CustomText>
    </View>
  );
}
