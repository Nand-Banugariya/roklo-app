import {
  CalendarX2,
  CheckCheck,
  Ellipsis,
  FilePen,
  Hourglass,
  Play,
  Repeat,
  Reply,
  Send,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { memo, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { STATUS } from "../constants";
import type { Broadcast } from "../types";
import {
  formatCount,
  formatWhen,
  isFinished,
  isRepeatEnded,
  percent,
  plannedOf,
  plural,
  repeatLabel,
} from "../utils/broadcast-format";
import {
  CardPanelView,
  hasCardActions,
  type BroadcastActionResult,
  type BroadcastCardAction,
  type CardPanel,
} from "./broadcast-actions";
import { ProgressBar, TagChips } from "./broadcast-parts";

const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * One broadcast, readable at a glance: a pill in its status's colour, its name and what it sends
 * with, then the one thing that matters for that status (live progress, the next send as a calendar date,
 * "not scheduled yet", or how it ended), and its numbers as chips: audience, delivered, replied, failed.
 * Drafts, scheduled and paused ones have the web's options under a ⋯ button, as the WhatsApp number card: the
 * screen lays the menu over the list, and a picked form (tags, Cancel / Delete) opens inside the card.
 */
export const BroadcastCard = memo(function BroadcastCard({
  broadcast,
  fromNumber,
  onPress,
  menuOpen = false,
  panel = null,
  feedback = null,
  onMenu,
  onClosePanel,
  onConfirm,
  onAction,
  onSaveTags,
}: {
  broadcast: Broadcast;
  fromNumber: string | null;
  onPress: () => void;
  /** Its ⋯ menu is open (drawn by the screen). */
  menuOpen?: boolean;
  /** The form picked from the menu, open in the card. */
  panel?: CardPanel | null;
  /** An action run from the menu: running, done (a line to confirm it) or failed. */
  feedback?: { text: string; error?: boolean; busy?: boolean } | null;
  /** The ⋯ button was pressed; the screen places the menu under it. */
  onMenu?: (broadcast: Broadcast, button: View) => void;
  onClosePanel?: (broadcast: Broadcast, notice?: string) => void;
  /** Cancel or Delete, confirmed in the card: an error to show, or null once done. */
  onConfirm?: (broadcast: Broadcast, action: "cancel" | "delete") => Promise<string | null>;
  /** Paused ones resume from the card's footer. */
  onAction?: (broadcast: Broadcast, action: BroadcastCardAction) => Promise<BroadcastActionResult>;
  /** Edit tags: resolves to an error to show, or null once saved. */
  onSaveTags?: (broadcast: Broadcast, tagIds: string[]) => Promise<string | null>;
}) {
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const menuButton = useRef<View>(null);
  const actions = !!onMenu && hasCardActions(broadcast);
  const { colors } = useRokloTheme();
  const status = STATUS[broadcast.status];
  const planned = plannedOf(broadcast);
  const live = broadcast.status === "RUNNING" || broadcast.status === "PAUSED";
  const paused = broadcast.status === "PAUSED";
  const finished = isFinished(broadcast.status);
  const repeat =
    broadcast.status !== "COMPLETED" ? repeatLabel(broadcast.repeat, broadcast.scheduledAt) : "";
  const endedPaused = broadcast.status === "PAUSED" && isRepeatEnded(broadcast.repeat);
  const subtitle = [broadcast.templateName, fromNumber ? `from ${fromNumber}` : null]
    .filter(Boolean)
    .join(" · ");
  const sentShare = percent(broadcast.sent, planned);
  // What a paused broadcast still has to send when it resumes.
  const left = Math.max(0, planned - broadcast.sent - broadcast.failed);
  // Done: a report of how it went, without the progress bar.
  const menuButtonNode = actions && (
    <MotionPressable
      ref={menuButton}
      role="button"
      accessibilityLabel={`Options for ${broadcast.name}`}
      accessibilityState={{ expanded: menuOpen }}
      onPress={() => {
        if (menuButton.current) onMenu?.(broadcast, menuButton.current);
      }}
      className={cn(
        "-mr-2 -mt-2.5 h-11 w-10 items-center justify-center rounded-full",
        menuOpen ? "bg-accent" : "active:bg-accent",
      )}
    >
      <CustomIcon as={Ellipsis} size={20} className="text-ink-600" />
    </MotionPressable>
  );
  // What came of an option picked from the menu.
  const feedbackNode = feedback && (
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
  );
  // The form picked from the menu, at the card's foot.
  const panelNode = panel && onConfirm && onSaveTags && onClosePanel && (
    <CardPanelView
      broadcast={broadcast}
      panel={panel}
      onConfirm={(action) => onConfirm(broadcast, action)}
      onSaveTags={onSaveTags}
      onClose={(notice) => onClosePanel(broadcast, notice)}
    />
  );
  if (finished)
    return (
      <ResultCard
        broadcast={broadcast}
        subtitle={subtitle}
        onPress={onPress}
        menuButton={menuButtonNode}
        feedback={feedbackNode}
        panel={panelNode}
      />
    );
  return (
    <MotionPressable
      role="button"
      onPress={onPress}
      accessibilityHint={
        broadcast.status === "DRAFT" ? "Opens the draft to finish it" : "Opens the broadcast"
      }
      accessibilityLabel={`${broadcast.name}, ${status.label}${live ? `, ${formatCount(broadcast.sent)} of ${formatCount(planned)} sent` : ""}`}
      className="mx-4 overflow-hidden rounded-[20px] border border-border bg-card shadow-sm shadow-black/5 active:opacity-90"
    >
      <View className="gap-3.5 p-4">
        <View className="flex-row items-start gap-3">
          <View className="min-w-0 flex-1 gap-0.5">
            <CustomText
              numberOfLines={1}
              className="font-sans-semibold text-[16px] tracking-[-0.2px]"
            >
              {broadcast.name}
            </CustomText>
            {!!subtitle && (
              <CustomText numberOfLines={1} className="text-[13px] text-muted-foreground">
                {subtitle}
              </CustomText>
            )}
          </View>
          <View
            className={cn("h-6 flex-row items-center gap-1.5 rounded-full px-2.5", status.pill)}
          >
            <View className={cn("h-1.5 w-1.5 rounded-full", status.bar)} />
            <CustomText className={cn("font-sans-semibold text-[11px]", status.text)}>
              {status.label}
            </CustomText>
          </View>
          {menuButtonNode}
        </View>
        {broadcast.tags.length > 0 && <TagChips tags={broadcast.tags} />}

        {/* Paused: who it's for as a plain line under the name, as the finished card shows it. */}
        {paused && broadcast.totalRecipients > 0 && (
          <Note
            icon={UsersRound}
            tone="text-muted-foreground"
            text={`${formatCount(broadcast.totalRecipients)} ${broadcast.totalRecipients === 1 ? "recipient" : "recipients"}`}
          />
        )}

        {/* The one thing that matters in this status. */}
        {broadcast.status === "SCHEDULED" ? (
          <NextSend at={broadcast.nextScheduledAt} repeat={repeat} />
        ) : broadcast.status === "DRAFT" ? (
          <Hint icon={FilePen} title="Not scheduled yet" body="Tap to finish it and schedule it." />
        ) : live && planned > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-end justify-between">
              <CustomText className="text-[13px] text-muted-foreground">
                <CustomText className="font-sans-semibold text-[13px] text-foreground">
                  {formatCount(broadcast.sent)}
                </CustomText>{" "}
                of {formatCount(planned)} sent
              </CustomText>
              <CustomText className="font-sans-semibold text-[20px] leading-6 tracking-[-0.5px] text-foreground">
                {sentShare || "0%"}
              </CustomText>
            </View>
            <ProgressBar
              sent={broadcast.sent}
              failed={broadcast.failed}
              total={planned}
              barClass={status.bar}
              live={broadcast.status === "RUNNING"}
              height={6}
              label={`${broadcast.name} progress`}
            />
            {!!repeat && live && <Note icon={Repeat} text={repeat} tone="text-muted-foreground" />}
          </View>
        ) : null}

        {/* Anything that needs attention. */}
        {(broadcast.stuckDueToCapAt || endedPaused) && (
          <View className="gap-1.5">
            {broadcast.stuckDueToCapAt && (
              <Note
                icon={Hourglass}
                text="Waiting for the daily limit to reset"
                tone="text-error-fg"
              />
            )}
            {endedPaused && (
              <Note
                icon={CalendarX2}
                text="End date passed. It can't resume."
                tone="text-warning-fg"
              />
            )}
          </View>
        )}

        {/* Its numbers. */}
        {((!paused && broadcast.totalRecipients > 0) ||
          broadcast.sent > 0 ||
          broadcast.failed > 0) && (
          <View className="flex-row flex-wrap items-center gap-1.5">
            {!paused && broadcast.totalRecipients > 0 && (
              <Chip
                icon={UsersRound}
                value={formatCount(broadcast.totalRecipients)}
                label="recipients"
              />
            )}
            {broadcast.sent > 0 && (
              <Chip
                icon={CheckCheck}
                value={percent(broadcast.delivered, broadcast.sent) || "0%"}
                label="delivered"
              />
            )}
            {broadcast.sent > 0 && (
              <Chip
                icon={Reply}
                value={percent(broadcast.replied, broadcast.sent) || "0%"}
                label="replied"
                tone="primary"
              />
            )}
            {broadcast.failed > 0 && (
              <Chip
                icon={TriangleAlert}
                value={formatCount(broadcast.failed)}
                label="failed"
                tone="error"
              />
            )}
          </View>
        )}
        {feedbackNode}
      </View>

      {/* The form picked from the menu, in place of the footer while open. */}
      {panelNode}

      {/* Paused: a footer across the card's bottom to carry on where it stopped. Past its end date it can't (the note above says so). */}
      {paused && onAction && !endedPaused && !panel && (
        <View className="gap-2 border-t border-border bg-ink-25 py-3 pl-5 pr-3">
          <View className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1 gap-0.5">
              <CustomText numberOfLines={1} className="font-sans-semibold text-sm text-foreground">
                {left > 0 ? `${plural(left, "message")} left` : "Ready to continue"}
              </CustomText>
              <CustomText numberOfLines={1} className="text-xs text-muted-foreground">
                Picks up where it stopped
              </CustomText>
            </View>
            <CustomButton
              size="sm"
              loading={resuming}
              loadingText="Resuming…"
              accessibilityLabel={`Resume sending ${broadcast.name}`}
              className="h-9 rounded-full px-4"
              leadingIcon={
                <CustomIcon
                  as={Play}
                  size={13}
                  strokeWidth={2.6}
                  color={colors["primary-foreground"]}
                  fill={colors["primary-foreground"]}
                />
              }
              onPress={async () => {
                if (resuming) return;
                setResuming(true);
                setResumeError(null);
                const result = await onAction(broadcast, "resume");
                setResuming(false);
                setResumeError(result && "error" in result ? result.error : null);
              }}
            >
              Resume
            </CustomButton>
          </View>
          {resumeError && (
            <CustomText role="alert" className="text-xs text-error-fg">
              {resumeError}
            </CustomText>
          )}
        </View>
      )}
    </MotionPressable>
  );
});

/**
 * A finished broadcast: no progress bar, just its tags, when it went out and to how many, and its failures. Its status pill keeps the colour.
 * Its ⋯ (Duplicate, Edit tags), the outcome of a pick and the picked form come from BroadcastCard.
 */
function ResultCard({
  broadcast,
  subtitle,
  onPress,
  menuButton,
  feedback,
  panel,
}: {
  broadcast: Broadcast;
  subtitle: string;
  onPress: () => void;
  menuButton: ReactNode;
  feedback: ReactNode;
  panel: ReactNode;
}) {
  const status = STATUS[broadcast.status];
  const planned = plannedOf(broadcast);
  const sentAt = formatWhen(broadcast.lastSentAt);
  return (
    <MotionPressable
      role="button"
      onPress={onPress}
      accessibilityHint="Opens the broadcast"
      accessibilityLabel={`${broadcast.name}, ${status.label}${sentAt ? `, sent ${sentAt}` : ""}${broadcast.failed ? `, ${formatCount(broadcast.failed)} failed` : ""}`}
      className="mx-4 overflow-hidden rounded-[20px] border border-border bg-card shadow-sm shadow-black/5 active:opacity-90"
    >
      <View className="gap-3.5 p-4">
        <View className="flex-row items-start gap-3">
          <View className="min-w-0 flex-1 gap-0.5">
            <CustomText
              numberOfLines={1}
              className="font-sans-semibold text-[16px] tracking-[-0.2px]"
            >
              {broadcast.name}
            </CustomText>
            {!!subtitle && (
              <CustomText numberOfLines={1} className="text-[13px] text-muted-foreground">
                {subtitle}
              </CustomText>
            )}
          </View>
          <View className={cn("h-6 flex-row items-center gap-1 rounded-full px-2.5", status.pill)}>
            {/* A completed send's ticks in the brand colour, as a read message's. */}
            <CustomIcon
              as={status.icon}
              size={12}
              strokeWidth={2.4}
              className={broadcast.status === "COMPLETED" ? "text-primary" : status.text}
            />
            <CustomText className={cn("font-sans-semibold text-[11px]", status.text)}>
              {status.label}
            </CustomText>
          </View>
          {menuButton}
        </View>
        {broadcast.tags.length > 0 && <TagChips tags={broadcast.tags} />}

        {(!!sentAt || planned > 0) && (
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {!!sentAt && <Note icon={Send} text={`Sent ${sentAt}`} tone="text-muted-foreground" />}
            {planned > 0 && (
              <Note
                icon={UsersRound}
                text={`${formatCount(planned)} ${planned === 1 ? "recipient" : "recipients"}`}
                tone="text-muted-foreground"
              />
            )}
          </View>
        )}

        {broadcast.failed > 0 && (
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Chip
              icon={TriangleAlert}
              value={formatCount(broadcast.failed)}
              label="failed"
              tone="error"
            />
          </View>
        )}
        {feedback}
      </View>
      {panel}
    </MotionPressable>
  );
}

/** A scheduled broadcast's next send: a calendar tile with its date, the day and time, and how it repeats. */
function NextSend({ at, repeat }: { at: string | null; repeat: string }) {
  const date = at ? new Date(at) : null;
  const valid = date && !Number.isNaN(date.getTime());
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-info-bg p-2.5">
      <View className="h-12 w-11 items-center overflow-hidden rounded-xl border border-info-border bg-card">
        <View className="w-full items-center bg-info-solid py-0.5">
          <CustomText className="font-sans-bold text-[9px] tracking-[0.6px] text-white">
            {valid ? MONTH[date.getMonth()] : "—"}
          </CustomText>
        </View>
        <CustomText className="font-sans-semibold text-[18px] leading-7 text-foreground">
          {valid ? date.getDate() : "?"}
        </CustomText>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <CustomText className="text-xs text-info-fg">Next send</CustomText>
        <CustomText numberOfLines={1} className="font-sans-semibold text-[15px]">
          {valid ? formatWhen(at, { weekday: true }) : "Not set"}
        </CustomText>
        {!!repeat && <Note icon={Repeat} text={repeat} tone="text-muted-foreground" />}
      </View>
    </View>
  );
}

function Hint({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-accent p-2.5">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-card">
        <CustomIcon as={icon} size={18} className="text-ink-600" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <CustomText className="font-sans-semibold text-sm">{title}</CustomText>
        <CustomText className="text-xs text-muted-foreground">{body}</CustomText>
      </View>
    </View>
  );
}

/** One number with its icon and word: "5,000 recipients", "92% delivered". */
function Chip({
  icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: "primary" | "error";
}) {
  const color =
    tone === "primary" ? "text-primary" : tone === "error" ? "text-error-fg" : "text-ink-600";
  return (
    <View
      className={cn(
        "h-7 flex-row items-center gap-1.5 rounded-full px-2.5",
        tone === "error" ? "bg-error-bg-2" : tone === "primary" ? "bg-brand-50" : "bg-accent",
      )}
    >
      <CustomIcon as={icon} size={12} strokeWidth={2.2} className={color} />
      <CustomText className={cn("font-sans-semibold text-xs", tone ? color : "text-foreground")}>
        {value}
      </CustomText>
      <CustomText className={cn("text-xs", tone ? color : "text-muted-foreground")}>
        {label}
      </CustomText>
    </View>
  );
}

function Note({ icon, text, tone }: { icon: LucideIcon; text: string; tone: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <CustomIcon as={icon} size={12} className={tone} />
      <CustomText className={cn("font-sans-medium text-xs", tone)}>{text}</CustomText>
    </View>
  );
}
