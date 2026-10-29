import { ChevronDown, ChevronUp, Clock3, X } from "lucide-react-native";
import { memo, useEffect, useRef, useState } from "react";
import { BackHandler, FlatList, Keyboard, ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { useMessaging } from "../providers/messaging-context";
import type { ScheduledMessage } from "../types";
import {
  defaultSchedule,
  formatSchedule,
  scheduleDate,
  scheduleDays,
  scheduleError,
} from "../utils/scheduling";

const ROW_HEIGHT = 44;

/** Three visible rows, with the centre row selected, like a phone's clock. */
export const ScheduleWheel = memo(function ScheduleWheel({
  label,
  options,
  value,
  onChange,
  disabled,
  wide = false,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (index: number) => void;
  disabled: boolean;
  wide?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const initialized = useRef(false);
  const [initialValue] = useState(value);
  const reducedMotion = useReducedMotion();
  const clamp = (index: number) => Math.max(0, Math.min(options.length - 1, index));
  function choose(index: number) {
    const next = clamp(index);
    onChange(next);
    scroll.current?.scrollTo({ y: next * ROW_HEIGHT, animated: !reducedMotion });
  }
  return (
    <View className={cn("min-w-0 gap-2", wide ? "flex-[2.5]" : "flex-1")}>
      <CustomText className="text-center text-xs text-muted-foreground">{label}</CustomText>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: options.length - 1, now: value, text: options[value] }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (!disabled) choose(value + (nativeEvent.actionName === "increment" ? 1 : -1));
        }}
        style={{ height: ROW_HEIGHT * 3 }}
      >
        <View
          pointerEvents="none"
          className="absolute inset-x-0 rounded-lg bg-accent"
          style={{ top: ROW_HEIGHT, height: ROW_HEIGHT }}
        />
        <ScrollView
          ref={scroll}
          scrollEnabled={!disabled}
          showsVerticalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          snapToInterval={ROW_HEIGHT}
          disableIntervalMomentum
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingVertical: ROW_HEIGHT }}
          contentOffset={{ x: 0, y: initialValue * ROW_HEIGHT }}
          onContentSizeChange={() => {
            if (initialized.current) return;
            initialized.current = true;
            scroll.current?.scrollTo({ y: initialValue * ROW_HEIGHT, animated: false });
          }}
          onScroll={({ nativeEvent }) =>
            onChange(clamp(Math.round(nativeEvent.contentOffset.y / ROW_HEIGHT)))
          }
        >
          {options.map((option, index) => (
            <MotionPressable
              key={`${index}:${option}`}
              role="button"
              accessibilityLabel={`${label}: ${option}`}
              accessibilityState={{ selected: index === value, disabled }}
              disabled={disabled}
              onPress={() => choose(index)}
              style={{ height: ROW_HEIGHT }}
              className="items-center justify-center px-1"
            >
              <CustomText
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
                className={cn(
                  wide ? "text-[13px]" : "text-lg",
                  index === value ? "font-sans-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {option}
              </CustomText>
            </MotionPressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
});

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

/** Takes the composer's place, keeping its draft intact until the server accepts it. */
export function ScheduleMessagePicker({
  preview,
  disabled,
  onCancel,
  onConfirm,
}: {
  preview: string;
  disabled: boolean;
  onCancel: () => void;
  /** Null means queued successfully; otherwise keep the draft and show the error. */
  onConfirm: (at: Date) => Promise<string | null>;
}) {
  const [openedAt] = useState(() => new Date());
  const [days] = useState(() => scheduleDays(openedAt));
  const [dayLabels] = useState(() =>
    days.map((date, index) =>
      index === 0
        ? "Today"
        : index === 1
          ? "Tomorrow"
          : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    ),
  );
  const [initial] = useState(() => defaultSchedule(openedAt));
  const [day, setDay] = useState(() =>
    days.findIndex((date) => date.toDateString() === initial.toDateString()),
  );
  const [hour, setHour] = useState(() => (initial.getHours() + 11) % 12);
  const [minute, setMinute] = useState(initial.getMinutes());
  const [period, setPeriod] = useState(initial.getHours() >= 12 ? 1 : 0);
  const [now, setNow] = useState(openedAt);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const date = scheduleDate(days[day], hour + 1, minute, period === 0 ? "AM" : "PM");
  const invalid = scheduleError(date, now);
  const locked = disabled || busy;
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!submitting.current) onCancel();
      return true;
    });
    return () => listener.remove();
  }, [onCancel]);
  async function confirm() {
    if (locked || submitting.current) return;
    const issue = scheduleError(date);
    if (issue || !date) {
      setError(issue);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const message = await onConfirm(date);
      if (mounted.current) setError(message);
    } catch {
      if (mounted.current)
        setError("Couldn't schedule this message. Your draft is saved; try again.");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View
      className="gap-3 rounded-2xl border border-border bg-card p-4"
      accessibilityLabel="Schedule message"
    >
      <View className="flex-row items-center gap-2">
        <CustomIcon as={Clock3} size={21} className="text-primary" />
        <CustomText role="heading" className="flex-1 font-sans-semibold text-base">
          Schedule message
        </CustomText>
        <MotionPressable
          role="button"
          accessibilityLabel="Cancel scheduling, keep draft"
          disabled={busy}
          onPress={onCancel}
          className="-mr-2 h-11 w-11 items-center justify-center rounded-full active:bg-accent"
        >
          <CustomIcon as={X} size={20} className="text-muted-foreground" />
        </MotionPressable>
      </View>
      <CustomText numberOfLines={1} className="text-sm text-muted-foreground">
        {preview}
      </CustomText>
      <View className="flex-row gap-2">
        <ScheduleWheel
          label="Date"
          options={dayLabels}
          value={day}
          onChange={setDay}
          disabled={locked}
          wide
        />
        <ScheduleWheel
          label="Hour"
          options={HOURS}
          value={hour}
          onChange={setHour}
          disabled={locked}
        />
        <ScheduleWheel
          label="Minute"
          options={MINUTES}
          value={minute}
          onChange={setMinute}
          disabled={locked}
        />
        <ScheduleWheel
          label="AM/PM"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          disabled={locked}
        />
      </View>
      <CustomText className="text-center text-xs text-muted-foreground">
        Your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </CustomText>
      {(error || invalid || disabled) && (
        <CustomText role="alert" className="text-sm text-error-fg">
          {disabled ? "Sending is currently unavailable for this conversation." : invalid || error}
        </CustomText>
      )}
      <CustomButton
        size="xl"
        fullWidth
        disabled={disabled || !!invalid}
        loading={busy}
        loadingText="Scheduling"
        onPress={() => void confirm()}
        accessibilityLabel={date ? `Schedule for ${formatSchedule(date)}` : "Schedule message"}
      >
        {date ? `Send ${formatSchedule(date)}` : "Schedule message"}
      </CustomButton>
    </View>
  );
}

export function ChatScheduledMessages({
  items,
  error,
  onReload,
  onChanged,
  canSend,
}: {
  items: ScheduledMessage[];
  error: string | null;
  onReload: () => void;
  onChanged: (message: ScheduledMessage) => void;
  canSend: boolean;
}) {
  const { api } = useMessaging();
  const [open, setOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  if (!items.length && !error) return null;
  async function run(item: ScheduledMessage, action: "cancel" | "send" | "retry") {
    if (
      inFlight.current ||
      !item.canManage ||
      item.status === "PROCESSING" ||
      (action !== "cancel" && !canSend)
    )
      return;
    inFlight.current = true;
    setBusyId(item.id);
    setActionError(null);
    try {
      const result = await (action === "cancel"
        ? api.cancelScheduled(item.id)
        : action === "retry"
          ? api.retryScheduled(item.id)
          : api.sendScheduledNow(item.id));
      if (!result.ok) {
        setActionError(result.message || "Couldn't update this message. Try again.");
        onReload();
        return;
      }
      onChanged(result.data);
      setCancelId(null);
    } catch {
      setActionError("Couldn't update this message. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusyId(null);
    }
  }
  const failed = items.filter((item) => item.status === "FAILED").length;
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      <MotionPressable
        role="button"
        accessibilityLabel={`${items.length} scheduled messages${failed ? `, ${failed} failed` : ""}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(!open);
          setCancelId(null);
        }}
        className="min-h-11 flex-row items-center gap-2 px-3 py-2 active:bg-accent"
      >
        <CustomIcon as={Clock3} size={16} className="text-primary" />
        <CustomText className="flex-1 font-sans-medium text-[13px]">
          {items.length} scheduled{failed ? ` Â· ${failed} failed` : ""}
        </CustomText>
        <CustomIcon
          as={open ? ChevronUp : ChevronDown}
          size={16}
          className="text-muted-foreground"
        />
      </MotionPressable>
      {error && (
        <View className="flex-row items-center gap-2 px-3 pb-2">
          <CustomText role="alert" className="flex-1 text-xs text-error-fg">
            {error}
          </CustomText>
          <CustomButton variant="link" size="sm" onPress={onReload}>
            Retry
          </CustomButton>
        </View>
      )}
      {actionError && (
        <CustomText role="alert" className="px-3 pb-2 text-xs text-error-fg">
          {actionError}
        </CustomText>
      )}
      {open && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 208 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          initialNumToRender={3}
          renderItem={({ item }) => (
            <View className="gap-1 border-t border-border px-3 py-2">
              <CustomText className="font-sans-semibold text-xs text-primary">
                {item.status === "PROCESSING"
                  ? "Sendingâ€¦"
                  : item.status === "FAILED"
                    ? "Couldn't send"
                    : formatSchedule(item.scheduledAt)}
              </CustomText>
              <CustomText numberOfLines={2} className="text-sm">
                {item.body ||
                  (item.files.length
                    ? item.fileNames?.filter(Boolean).join(", ") ||
                      `${item.files.length} attachment(s)`
                    : "Message")}
              </CustomText>
              {item.failureReason && (
                <CustomText className="text-xs text-error-fg">{item.failureReason}</CustomText>
              )}
              {item.canManage && item.status !== "PROCESSING" && (
                <View className="flex-row flex-wrap gap-2">
                  {cancelId === item.id ? (
                    <>
                      <CustomText className="w-full text-xs text-muted-foreground">
                        Cancel this scheduled message?
                      </CustomText>
                      <CustomButton
                        variant="destructive"
                        size="sm"
                        disabled={!!busyId}
                        loading={busyId === item.id}
                        onPress={() => void run(item, "cancel")}
                      >
                        Cancel message
                      </CustomButton>
                      <CustomButton
                        variant="ghost"
                        size="sm"
                        disabled={!!busyId}
                        onPress={() => setCancelId(null)}
                      >
                        Keep it
                      </CustomButton>
                    </>
                  ) : (
                    <>
                      <CustomButton
                        variant="ghost"
                        size="sm"
                        disabled={!!busyId || !canSend}
                        loading={busyId === item.id}
                        onPress={() => void run(item, item.status === "FAILED" ? "retry" : "send")}
                      >
                        {item.status === "FAILED" ? "Retry now" : "Send now"}
                      </CustomButton>
                      <CustomButton
                        variant="ghost"
                        size="sm"
                        disabled={!!busyId}
                        onPress={() => setCancelId(item.id)}
                      >
                        Cancel
                      </CustomButton>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
