import { CustomBackButton } from "@/components/shadcn-custom/custombackbutton";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { ScheduleWheel } from "@/features/messaging/components/chat-scheduling";
import { useMessaging } from "@/features/messaging/providers/messaging-provider";
import { KeyboardScreen } from "@/features/navigation/components/keyboard-screen";
import {
  isConnected,
  type OutgoingFile,
  numberName,
  numberPhone,
} from "@/features/messaging/types";
import {
  defaultSchedule,
  formatSchedule,
  scheduleDate,
} from "@/features/messaging/utils/scheduling";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { goBack } from "@/features/navigation/components/screen-header";
import { StepHeader } from "@/features/onboarding/components/step-header";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Globe,
  Lock,
  Minus,
  Plus,
  Repeat,
  Send,
  Smartphone,
  TriangleAlert,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BackHandler, Keyboard, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccessPicker, type AccessValue } from "../components/access-picker";
import { AttachmentPicker } from "../components/attachment-picker";
import { DateField } from "../components/date-field";
import { MessageEditor } from "../components/message-editor";
import { BODY_MAX } from "../constants";
import { AudiencePicker, audienceCount, directChats, raised } from "../components/audience-picker";
import { TagPicker } from "../components/tag-picker";
import { createBroadcast, loadDraft, updateBroadcast } from "../services/broadcasts-service";
import { DEFAULT_BATCH, SEND_NOW_LEAD } from "../services/broadcasts-api";
import type {
  NewAudience,
  NewBroadcastInput,
  RepeatType,
  SavedFile,
  UnsavedContact,
  WeekDay,
} from "../types";
import { dayKey, formatCount, plural, zoneLabel } from "../utils/broadcast-format";

/** The web builder's four steps. */
const STEPS = ["Audience", "Message", "Schedule", "Review"] as const;
type Step = 0 | 1 | 2 | 3;
type IssueKey =
  "name" | "access" | "numbers" | "audience" | "message" | "schedule" | "weekDays" | "until";
/** Each step's checked fields, top to bottom as on screen. */
const STEP_FIELDS: IssueKey[][] = [
  ["name", "access", "numbers", "audience"],
  ["message"],
  ["schedule", "weekDays", "until"],
  [],
];
const NAME_MAX = 60;
const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const PERIODS = ["AM", "PM"];
const WEEK: { value: WeekDay; short: string }[] = [
  { value: "MONDAY", short: "Mon" },
  { value: "TUESDAY", short: "Tue" },
  { value: "WEDNESDAY", short: "Wed" },
  { value: "THURSDAY", short: "Thu" },
  { value: "FRIDAY", short: "Fri" },
  { value: "SATURDAY", short: "Sat" },
  { value: "SUNDAY", short: "Sun" },
];
const WEEKDAY_OF_INDEX: WeekDay[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];
/** The picked time is now or behind us (read outside render). */
const hasPassed = (date: Date) => date.getTime() <= Date.now();
/** "Now", as the web sends it: a few seconds ahead. */
const sendNowAt = () => new Date(Date.now() + SEND_NOW_LEAD).toISOString();
type When = "now" | "later" | "repeat";
type Repeats = Exclude<RepeatType, "NONE">;

/**
 * A new broadcast in the web builder's four steps, laid out as onboarding is: a progress bar, one step a page,
 * Back and Continue. Audience (name, visibility, numbers, who), Message, Schedule (now, later or repeating,
 * and the sending pace), then Review to send. A draft can be saved from any step; it only needs a name.
 */
export function NewBroadcastScreen() {
  const { colors } = useRokloTheme();
  const { numbers, activeNumber } = useMessaging();
  const dispatch = useAppDispatch();
  // `id`: a saved draft, reopened from the list to finish it.
  const { id: openedId } = useLocalSearchParams<{ id?: string }>();
  // The draft this screen saves to: the one opened, or the one its first "Save draft" made.
  const [draftId, setDraftId] = useState<string | null>(openedId ?? null);
  const [draftLoad, setDraftLoad] = useState<"loading" | "ready" | string>(
    openedId ? "loading" : "ready",
  );
  // The draft's first send as saved: sent unchanged, the API would fire it at once (see save).
  const [savedStart, setSavedStart] = useState<string | null>(null);
  // "Draft saved at …" in the header, and "Saved" on the button for a moment.
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [justSaved]);
  const connected = numbers.filter(isConnected);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // "IST", as the web labels its times.
  const zoneName = zoneLabel(zone);
  const scroll = useRef<ScrollView>(null);
  const scrollContent = useRef<View>(null);
  // Scrolls the form so a part of it sits at the top.
  const reveal = useCallback((target: View | null | undefined) => {
    const content = scrollContent.current;
    if (!target || !content) return;
    target.measureLayout(content, (_x, y) =>
      scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }),
    );
  }, []);
  // The audience search, scrolled up so its results show above the keyboard.
  const revealSearch = useCallback(
    (searchBar: View) => {
      reveal(searchBar);
      // Again once the keyboard is up and the screen has made room for it.
      setTimeout(() => reveal(searchBar), 350);
    },
    [reveal],
  );
  // Each checked field, so a blocked Continue or Send can jump to the first one with an error.
  const nameField = useRef<View>(null);
  const accessField = useRef<View>(null);
  const numbersField = useRef<View>(null);
  const audienceField = useRef<View>(null);
  const messageField = useRef<View>(null);
  const scheduleField = useRef<View>(null);
  const weekDaysField = useRef<View>(null);
  const untilField = useRef<View>(null);
  // Set when a step is blocked; jumped to once that step has rendered with its errors.
  const [jumpTo, setJumpTo] = useState<IssueKey | null>(null);
  useEffect(() => {
    if (!jumpTo) return;
    const frame = requestAnimationFrame(() => {
      const fields: Record<IssueKey, RefObject<View | null>> = {
        name: nameField,
        access: accessField,
        numbers: numbersField,
        audience: audienceField,
        message: messageField,
        schedule: scheduleField,
        weekDays: weekDaysField,
        until: untilField,
      };
      reveal(fields[jumpTo].current);
      setJumpTo(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [jumpTo, reveal]);
  const [step, setStep] = useState<Step>(0);
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false]);

  // Step 1: Audience.
  const [name, setName] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"EVERYONE" | "TEAM" | "ME_ONLY">("EVERYONE");
  const [access, setAccess] = useState<AccessValue>({
    teamIds: [],
    memberIds: [],
  });
  // The number the inbox works from, else the only connected one.
  const [sessionIds, setSessionIds] = useState<string[]>(() =>
    activeNumber && isConnected(activeNumber)
      ? [activeNumber.id]
      : connected.length === 1
        ? [connected[0].id]
        : [],
  );
  const [audience, setAudience] = useState<NewAudience>({
    rokloGroups: [],
    waGroups: [],
    contacts: [],
  });
  // Step 2: Message.
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<OutgoingFile[]>([]);
  // A reopened draft's saved files, and what mobile keeps without editing (a web template and versions).
  const [kept, setKept] = useState<SavedFile[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [variations, setVariations] = useState<string[]>([]);
  // Step 3: Schedule.
  const [when, setWhen] = useState<When>("now");
  const [openedAt] = useState(() => new Date());
  const [initial] = useState(() => defaultSchedule(openedAt));
  // The first send: its day from the calendar, its time from the wheels.
  const [day, setDay] = useState(
    () => new Date(initial.getFullYear(), initial.getMonth(), initial.getDate()),
  );
  const [hour, setHour] = useState(() => (initial.getHours() + 11) % 12);
  const [minute, setMinute] = useState(initial.getMinutes());
  const [period, setPeriod] = useState(initial.getHours() >= 12 ? 1 : 0);
  const [repeats, setRepeats] = useState<Repeats>("WEEKLY");
  const [every, setEvery] = useState(1);
  const [weekDays, setWeekDays] = useState<WeekDay[]>(() => [WEEKDAY_OF_INDEX[initial.getDay()]]);
  // "Ends on": none keeps repeating.
  const [endDay, setEndDay] = useState<Date | null>(null);
  // Sending.
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState<UnsavedContact[] | null>(null);

  // A reopened draft: every field filled back in, as the web's builder does. Bumped by "Try again".
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (!openedId) return;
    let current = true;
    void dispatch(loadDraft(openedId)).then((result) => {
      if (!current) return;
      if (!result.ok) {
        setDraftLoad(result.message || "Couldn't open this draft. Try again.");
        return;
      }
      const draft = result.data;
      setName(draft.name);
      setTagIds(draft.tagIds);
      setVisibility(draft.visibility);
      setAccess({ teamIds: draft.teamIds, memberIds: draft.memberIds });
      // Saved numbers that still exist; with none, every connected one (as the web seeds a saved broadcast).
      const live = draft.sessionIds.filter((id) => numbers.some((number) => number.id === id));
      setSessionIds(live.length ? live : connected.map((number) => number.id));
      setAudience(draft.audience);
      setContent(draft.content);
      setKept(draft.attachments);
      setTemplateId(draft.templateId);
      setVariations(draft.variations);
      // The first send: a repeat's start, else the next send.
      const startIso =
        draft.repeat.type !== "NONE"
          ? draft.scheduledAt
          : (draft.nextScheduledAt ?? draft.scheduledAt);
      const startAt = startIso ? new Date(startIso) : null;
      const valid = !!startAt && Number.isFinite(startAt.getTime());
      setWhen(
        draft.repeat.type !== "NONE"
          ? "repeat"
          : draft.sendMode === "NOW" || !valid
            ? "now"
            : "later",
      );
      if (valid) {
        setDay(new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate()));
        setHour((startAt.getHours() + 11) % 12);
        setMinute(startAt.getMinutes());
        setPeriod(startAt.getHours() >= 12 ? 1 : 0);
      }
      if (draft.repeat.type !== "NONE") {
        setRepeats(draft.repeat.type);
        setEvery(draft.repeat.interval ?? 1);
      }
      if (draft.repeat.weekDays.length) setWeekDays(draft.repeat.weekDays);
      if (draft.repeat.until) {
        const [year, month, date] = draft.repeat.until.slice(0, 10).split("-").map(Number);
        if (year && month && date) setEndDay(new Date(year, month - 1, date));
      }
      setSavedStart(draft.scheduledAt);
      setDraftLoad("ready");
    });
    return () => {
      current = false;
    };
    // Read once per opening: later changes to the numbers mustn't refill the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, openedId, loadAttempt]);

  const start =
    when === "now" ? null : scheduleDate(day, hour + 1, minute, period === 0 ? "AM" : "PM");
  const until = when === "repeat" && endDay ? dayKey(endDay) : null;
  // A day picked as the start: a weekly repeat on one day moves with it, as on the web.
  const pickDay = (next: Date) => {
    setDay(next);
    if (repeats === "WEEKLY" && weekDays.length <= 1)
      setWeekDays([WEEKDAY_OF_INDEX[next.getDay()]]);
  };
  // What still blocks each step, in the web builder's words.
  const allPicked =
    connected.length > 0 && connected.every((number) => sessionIds.includes(number.id));
  const issues = {
    name: !name.trim() ? "Give this broadcast a name to continue." : null,
    access:
      visibility === "TEAM" && !access.teamIds.length && !access.memberIds.length
        ? "Pick at least one team or person."
        : null,
    numbers: !connected.length
      ? "Connect a WhatsApp number to send broadcasts. You can still save a draft."
      : !sessionIds.length
        ? "Pick at least one WhatsApp number to send from."
        : null,
    audience: !audienceCount(audience) ? "Select at least one contact or group to continue." : null,
    // A file alone is a message too, as on the web.
    message:
      !content.trim() && !files.length && !kept.length ? "Write a message or attach a file." : null,
    // Any time ahead, as on the web (no limit on how far).
    schedule:
      when === "now"
        ? null
        : !start
          ? "Pick a date and time in the future."
          : hasPassed(start)
            ? "That time has already passed. Pick a later time."
            : null,
    weekDays:
      when === "repeat" && repeats === "WEEKLY" && !weekDays.length
        ? "Pick at least one day."
        : null,
    until:
      until && start && until < dayKey(start)
        ? "The end date must be on or after the first send."
        : null,
  };
  // A step's first field with an error, top to bottom.
  const firstIssue = (index: number) => STEP_FIELDS[index].find((key) => issues[key]);
  const stepOk = (index: number) => !firstIssue(index);
  const show = (index: number, issue: string | null) => (checked[index] ? issue : null);

  function goTo(next: Step) {
    Keyboard.dismiss();
    setStep(next);
    setError(null);
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
  }
  function next() {
    setChecked((old) => old.map((value, index) => (index === step ? true : value)));
    const blocked = firstIssue(step);
    if (blocked) {
      setJumpTo(blocked);
      return;
    }
    goTo((step + 1) as Step);
  }
  // Android's back steps back first, as onboarding's does.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (step === 0) return false;
        goTo((step - 1) as Step);
        return true;
      });
      return () => subscription.remove();
    }, [busy, step]),
  );

  async function save(kind: "send" | "draft", acknowledgeContactRisk = false) {
    if (busy) return;
    setError(null);
    if (kind === "draft" && issues.name) {
      setChecked((old) => [true, ...old.slice(1)]);
      goTo(0);
      setJumpTo("name");
      return;
    }
    if (kind === "send") {
      setChecked([true, true, true, true]);
      const first = [0, 1, 2].find((index) => !stepOk(index));
      if (first !== undefined) {
        goTo(first as Step);
        setJumpTo(firstIssue(first) ?? null);
        return;
      }
    }
    setBusy(kind);
    const input = (scheduledAt?: string): NewBroadcastInput => ({
      name,
      tagIds,
      visibility,
      ...(visibility === "TEAM" && access),
      audience,
      content,
      files,
      keepKeys: kept.map((file) => file.key),
      templateId,
      variations,
      sessionIds,
      when,
      // The web hides picking a speed (the API's pace is fixed), and sends its default break.
      batchSize: DEFAULT_BATCH,
      timezone: zone,
      scheduledAt,
      repeat: when === "repeat" ? { type: repeats, interval: every, weekDays, until } : undefined,
    });

    if (kind === "draft") {
      // The first save makes the draft; later ones update it, and the form stays open, as on the web.
      const draft = (acknowledge: boolean) =>
        dispatch(
          draftId
            ? updateBroadcast(draftId, input(), {
                acknowledgeContactRisk: acknowledge,
              })
            : createBroadcast(input(), {
                isDraft: true,
                acknowledgeContactRisk: acknowledge,
              }),
        );
      let result = await draft(false);
      // Saving a draft sends nothing, so unsaved contacts (E09) don't stop it.
      if (!result.ok && "unsavedContacts" in result) result = await draft(true);
      setBusy(null);
      if (!result.ok) {
        setError("error" in result ? result.error : result.message);
        return;
      }
      if (!draftId && result.id) setDraftId(result.id);
      setSavedAt(new Date());
      setJustSaved(true);
      return;
    }

    // A saved draft is scheduled (activated); otherwise a new broadcast is made.
    let scheduledAt: string | undefined;
    if (when === "now") scheduledAt = draftId ? undefined : sendNowAt();
    else if (start) {
      const at = new Date(start);
      // The API ignores a draft's unchanged time and fires it at once; nudge it by a second, as the web does.
      if (draftId && savedStart && new Date(savedStart).getTime() === at.getTime())
        at.setSeconds(at.getSeconds() + 1);
      scheduledAt = at.toISOString();
    }
    const result = await dispatch(
      draftId
        ? updateBroadcast(draftId, input(scheduledAt), {
            activate: true,
            acknowledgeContactRisk,
          })
        : createBroadcast(input(scheduledAt), { acknowledgeContactRisk }),
    );
    setBusy(null);
    if (result.ok) {
      setUnsaved(null);
      // Opens the broadcast to follow it.
      const sentId = draftId ?? result.id;
      if (!sentId) router.back();
      else
        router.replace({
          pathname: "/broadcast/[id]",
          params: { id: sentId },
        });
      return;
    }
    if ("unsavedContacts" in result) {
      setUnsaved(result.unsavedContacts);
      return;
    }
    setError(result.error);
  }

  const reach = directChats(audience);
  const sendLabel = when === "now" ? "Send now" : when === "later" ? "Schedule" : "Start repeating";
  const header = [
    {
      eyebrow: "Step 1 · Audience",
      title: "Who's it for?",
      description: "Name it, choose the numbers it sends from, then pick contacts and groups.",
    },
    {
      eyebrow: "Step 2 · Message",
      title: "What should it say?",
      description: "Everyone in the audience gets this message, one chat at a time.",
    },
    {
      eyebrow: "Step 3 · Schedule",
      title: "When should it go out?",
    },
    {
      eyebrow: "Step 4 · Review",
      title: "Check before you send",
      description: "Make sure everything looks right. Tap Edit to change a part.",
    },
  ][step];

  // The first send's day and time, as the web's two fields ("Date" or "Starts on", then "Time (IST)").
  const dayTime = (label: string) => (
    <View ref={scheduleField} className="gap-5">
      <Field label={label} required error={show(2, issues.schedule)}>
        <DateField
          label={label}
          value={day}
          onChange={(next) => next && pickDay(next)}
          min={openedAt}
          invalid={!!show(2, issues.schedule)}
          disabled={!!busy}
        />
      </Field>
      <Field label={`Time (${zoneName})`} required>
        <View className="flex-row gap-2 rounded-2xl border border-border bg-card p-3">
          <ScheduleWheel
            label="Hour"
            options={HOURS}
            value={hour}
            onChange={setHour}
            disabled={!!busy}
          />
          <ScheduleWheel
            label="Minute"
            options={MINUTES}
            value={minute}
            onChange={setMinute}
            disabled={!!busy}
          />
          <ScheduleWheel
            label="AM/PM"
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            disabled={!!busy}
          />
        </View>
      </Field>
    </View>
  );

  if (draftLoad !== "ready")
    return (
      <DraftOpening
        error={draftLoad === "loading" ? null : draftLoad}
        onRetry={() => {
          setDraftLoad("loading");
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-ink-50">
      {/* Lifts the form and its footer by the keyboard's real height (Android draws edge-to-edge). */}
      <KeyboardScreen>
        {/* As onboarding's header: close, title and Save draft, then the progress bar with the step's name. */}
        <View className="gap-4 border-b border-ink-200 bg-card px-5 pb-4 pt-2">
          <View className="min-h-11 flex-row items-center gap-2">
            <MotionPressable
              role="button"
              accessibilityLabel="Close"
              disabled={!!busy}
              onPress={goBack}
              className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-accent"
            >
              <CustomIcon as={X} size={22} className="text-foreground" />
            </MotionPressable>
            <View className="min-w-0 flex-1">
              <CustomText numberOfLines={1} className="font-sans-semibold text-base">
                {draftId ? name.trim() || "Untitled draft" : "New broadcast"}
              </CustomText>
              {/* As the web's header: when the draft was last saved, or that it's one. */}
              {(savedAt || openedId) && (
                <CustomText numberOfLines={1} className="text-xs text-muted-foreground">
                  {savedAt
                    ? `Draft saved at ${savedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                    : "Draft"}
                </CustomText>
              )}
            </View>
            <CustomButton
              variant="ghost"
              size="sm"
              className="min-h-11"
              loading={busy === "draft"}
              disabled={draftLoad !== "ready" || (!!busy && busy !== "draft")}
              onPress={() => void save("draft")}
            >
              {justSaved ? "Saved" : "Save draft"}
            </CustomButton>
          </View>
          <View
            className="gap-2.5"
            accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
          >
            <View className="flex-row gap-2" accessibilityElementsHidden>
              {STEPS.map((label, index) => (
                <View
                  key={label}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    index <= step ? "bg-brand-600" : "bg-ink-200",
                  )}
                />
              ))}
            </View>
            <View className="flex-row justify-between gap-2">
              <CustomText className="text-xs text-ink-600">
                Step {step + 1} of {STEPS.length}
              </CustomText>
              <CustomText className="font-sans-medium text-xs text-brand-700">
                {STEPS[step]}
              </CustomText>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scroll}
          innerViewRef={scrollContent as RefObject<View>}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="gap-7 px-5 pb-10 pt-6"
        >
          {step > 0 && (
            <View className="-mb-3 flex-row">
              <CustomBackButton disabled={!!busy} onPress={() => goTo((step - 1) as Step)} />
            </View>
          )}
          <StepHeader
            eyebrow={header.eyebrow}
            title={header.title}
            description={header.description}
          />

          {step === 0 && (
            <View className="gap-6">
              <View ref={nameField}>
                <CustomFormField
                  id="broadcast-name"
                  label="Broadcast name"
                  required
                  size="lg"
                  error={show(0, issues.name) ?? undefined}
                >
                  {(control) => (
                    <CustomInput
                      {...control}
                      value={name}
                      onChangeText={setName}
                      maxLength={NAME_MAX}
                      size="xl"
                      placeholder="e.g. Diwali desk offer"
                    />
                  )}
                </CustomFormField>
              </View>
              <Field label="Tags" optional>
                <TagPicker value={tagIds} onChange={setTagIds} />
              </Field>
              <View ref={accessField}>
                <Field label="Who can see it" required error={show(0, issues.access)}>
                  <View accessibilityRole="radiogroup" className="gap-2">
                    <Choice
                      icon={Globe}
                      label="Everyone"
                      hint="Everyone in the workspace can see it"
                      selected={visibility === "EVERYONE"}
                      onPress={() => setVisibility("EVERYONE")}
                    />
                    <Choice
                      icon={UsersRound}
                      label="Teams and people"
                      hint="Only the teams and people you pick"
                      selected={visibility === "TEAM"}
                      onPress={() => setVisibility("TEAM")}
                    />
                    <Choice
                      icon={Lock}
                      label="Only me"
                      hint="Only you can see it"
                      selected={visibility === "ME_ONLY"}
                      onPress={() => setVisibility("ME_ONLY")}
                    />
                  </View>
                  {visibility === "TEAM" && (
                    <View className="gap-2 rounded-2xl border border-border bg-card p-3.5">
                      <CustomText className="font-sans-semibold text-[13px] text-ink-900">
                        Teams and people <CustomText className="text-error-fg">*</CustomText>
                      </CustomText>
                      <AccessPicker value={access} onChange={setAccess} />
                    </View>
                  )}
                </Field>
              </View>

              {/* "Send from", as the web's picker: Select all, each number's sends today, an offline number only unpickable. */}
              <View ref={numbersField} className="gap-2.5 border-t border-ink-200 pt-6">
                <View className="flex-row items-end justify-between gap-2">
                  <View className="min-w-0 flex-1 gap-0.5">
                    <CustomText className="font-sans-semibold text-[15px] text-ink-900">
                      Send from
                    </CustomText>
                  </View>
                  {connected.length > 1 && (
                    <CustomButton
                      variant="link"
                      size="sm"
                      className="min-h-0 px-0"
                      onPress={() =>
                        setSessionIds((ids) =>
                          allPicked
                            ? ids.filter((id) => !connected.some((number) => number.id === id))
                            : [...new Set([...ids, ...connected.map((number) => number.id)])],
                        )
                      }
                    >
                      {allPicked ? "Clear all" : `Select all ${connected.length}`}
                    </CustomButton>
                  )}
                </View>
                {connected.length === 0 && (
                  <View className="gap-1 rounded-xl border border-warning-border bg-warning-bg p-3">
                    <CustomText className="font-sans-semibold text-sm text-warning-fg">
                      No connected WhatsApp number
                    </CustomText>
                    <CustomText className="text-[13px] leading-5 text-warning-fg">
                      Connect a number in WhatsApp numbers to send broadcasts. You can still save
                      this as a draft.
                    </CustomText>
                  </View>
                )}
                <View className="gap-2">
                  {numbers.map((number) => {
                    const live = isConnected(number);
                    const picked = sessionIds.includes(number.id);
                    // An offline number can still be unpicked, never newly picked.
                    const blocked = !live && !picked;
                    const cap = number.dailyCap ?? 0;
                    return (
                      <MotionPressable
                        key={number.id}
                        role="checkbox"
                        accessibilityState={{
                          checked: picked,
                          disabled: blocked,
                        }}
                        disabled={blocked}
                        onPress={() =>
                          setSessionIds((ids) =>
                            picked ? ids.filter((id) => id !== number.id) : [...ids, number.id],
                          )
                        }
                        className={cn(
                          "min-h-[60px] flex-row items-center gap-3 rounded-xl border px-3 py-2.5",
                          picked
                            ? "border-primary bg-brand-50"
                            : "border-border bg-card active:bg-accent",
                        )}
                        style={{ opacity: blocked ? 0.6 : 1 }}
                      >
                        <Tick checked={picked} />
                        <View className="min-w-0 flex-1 gap-0.5">
                          <View className="flex-row items-center gap-1.5">
                            <CustomIcon as={Smartphone} size={14} className="text-ink-700" />
                            <CustomText
                              numberOfLines={1}
                              className="shrink font-sans-medium text-[15px]"
                            >
                              {numberName(number)}
                            </CustomText>
                          </View>
                          <CustomText numberOfLines={1} className="text-xs text-ink-600">
                            {live
                              ? `${number.phoneNumber ? `${numberPhone(number)} · ` : ""}${formatCount(number.dailySentCount ?? 0)}${cap ? ` of ${formatCount(cap)}` : ""} sent today`
                              : "Not connected"}
                          </CustomText>
                        </View>
                      </MotionPressable>
                    );
                  })}
                </View>
                {!!show(0, issues.numbers) && (
                  <CustomText role="alert" className="font-sans-medium text-[13px] text-error-fg">
                    {issues.numbers}
                  </CustomText>
                )}
              </View>

              <View ref={audienceField} className="gap-3 border-t border-ink-200 pt-6">
                <View className="gap-0.5">
                  <CustomText className="font-sans-semibold text-[15px] text-ink-900">
                    Who should get this?
                  </CustomText>
                </View>
                <AudiencePicker
                  value={audience}
                  onChange={(value) => {
                    setAudience(value);
                    setUnsaved(null);
                  }}
                  sessionIds={sessionIds}
                  error={show(0, issues.audience)}
                  onSearchFocus={revealSearch}
                />
              </View>
            </View>
          )}

          {step === 1 && (
            <View className="gap-6">
              <View ref={messageField}>
                <CustomFormField
                  id="broadcast-message"
                  label="Message"
                  required
                  size="lg"
                  error={show(1, issues.message) ?? undefined}
                >
                  {(control) => (
                    <MessageEditor
                      control={control}
                      value={content}
                      onChange={setContent}
                      maxLength={BODY_MAX}
                      invalid={!!show(1, issues.message)}
                      disabled={!!busy}
                    />
                  )}
                </CustomFormField>
              </View>
              <Field label="Attachments" optional>
                <AttachmentPicker
                  files={files}
                  onChange={setFiles}
                  saved={kept}
                  onSavedChange={setKept}
                  disabled={!!busy}
                />
              </Field>
            </View>
          )}

          {step === 2 && (
            <View className="gap-6">
              <View className="gap-2.5">
                <View accessibilityRole="radiogroup" className="gap-2.5">
                  <Choice
                    icon={Send}
                    label="Send now"
                    hint="Starts right away at the speed below."
                    selected={when === "now"}
                    onPress={() => setWhen("now")}
                  />
                  <Choice
                    icon={CalendarClock}
                    label="Schedule for later"
                    hint={`Pick a date and time. Times are in ${zoneName}.`}
                    selected={when === "later"}
                    onPress={() => setWhen("later")}
                  />
                  <Choice
                    icon={Repeat}
                    label="Repeat"
                    hint="Send on a schedule: daily, weekly or monthly."
                    selected={when === "repeat"}
                    onPress={() => setWhen("repeat")}
                  />
                </View>
              </View>

              {when === "later" && dayTime("Date")}

              {when === "repeat" && (
                <View className="gap-5 rounded-2xl border border-border bg-card p-4">
                  {dayTime("Starts on")}
                  <Field label="Repeats">
                    <View className="flex-row gap-1 rounded-xl bg-accent p-1">
                      {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((type) => (
                        <MotionPressable
                          key={type}
                          role="radio"
                          accessibilityState={{ checked: repeats === type }}
                          onPress={() => setRepeats(type)}
                          className="h-9 flex-1 items-center justify-center rounded-lg"
                          style={repeats === type ? raised(colors.card) : undefined}
                        >
                          <CustomText
                            className={cn(
                              "text-[13px]",
                              repeats === type
                                ? "font-sans-semibold text-foreground"
                                : "font-sans-medium text-muted-foreground",
                            )}
                          >
                            {type[0] + type.slice(1).toLowerCase()}
                          </CustomText>
                        </MotionPressable>
                      ))}
                    </View>
                  </Field>
                  <Field
                    label={`Every (${repeats === "DAILY" ? "days" : repeats === "WEEKLY" ? "weeks" : "months"})`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Stepper
                        icon={Minus}
                        label="Fewer"
                        disabled={every <= 1}
                        onPress={() => setEvery((n) => Math.max(1, n - 1))}
                      />
                      <CustomText className="min-w-10 text-center font-sans-semibold text-lg">
                        {every}
                      </CustomText>
                      <Stepper
                        icon={Plus}
                        label="More"
                        disabled={every >= 30}
                        onPress={() => setEvery((n) => Math.min(30, n + 1))}
                      />
                    </View>
                  </Field>
                  {repeats === "WEEKLY" && (
                    <View ref={weekDaysField}>
                      <Field label="On" error={show(2, issues.weekDays)}>
                        <View className="flex-row flex-wrap gap-1.5">
                          {WEEK.map((item) => {
                            const on = weekDays.includes(item.value);
                            return (
                              <MotionPressable
                                key={item.value}
                                role="checkbox"
                                accessibilityState={{ checked: on }}
                                accessibilityLabel={item.short}
                                onPress={() =>
                                  setWeekDays((old) =>
                                    on
                                      ? old.filter((value) => value !== item.value)
                                      : [...old, item.value],
                                  )
                                }
                                className={cn(
                                  "h-10 min-w-11 items-center justify-center rounded-full border px-3",
                                  on
                                    ? "border-primary bg-primary"
                                    : "border-border bg-card active:bg-accent",
                                )}
                              >
                                <CustomText
                                  className={cn(
                                    "font-sans-semibold text-[13px]",
                                    on ? "text-primary-foreground" : "text-ink-700",
                                  )}
                                >
                                  {item.short}
                                </CustomText>
                              </MotionPressable>
                            );
                          })}
                        </View>
                      </Field>
                    </View>
                  )}
                  <View ref={untilField}>
                    <Field
                      label="Ends on"
                      optional
                      hint="Leave empty to keep repeating."
                      error={show(2, issues.until)}
                    >
                      <DateField
                        label="Ends on"
                        value={endDay}
                        onChange={setEndDay}
                        min={day}
                        placeholder="No end date"
                        clearable
                        invalid={!!show(2, issues.until)}
                        disabled={!!busy}
                      />
                    </Field>
                  </View>
                </View>
              )}
            </View>
          )}

          {step === 3 && (
            <View className="gap-4">
              <View className="overflow-hidden rounded-2xl border border-border bg-card">
                <ReviewRow
                  label="Name"
                  value={name.trim() || "Untitled broadcast"}
                  onEdit={() => goTo(0)}
                  first
                />
                <ReviewRow
                  label="Tags"
                  value={tagIds.length ? plural(tagIds.length, "tag") : "None"}
                  onEdit={() => goTo(0)}
                />
                <ReviewRow
                  label="Visible to"
                  onEdit={() => goTo(0)}
                  value={
                    visibility === "EVERYONE"
                      ? "Everyone"
                      : visibility === "ME_ONLY"
                        ? "Only me"
                        : `${plural(access.teamIds.length, "team")} and ${plural(access.memberIds.length, "person", "people")}`
                  }
                />
                <ReviewRow
                  label="From"
                  value={
                    sessionIds
                      .map((id) => numbers.find((number) => number.id === id))
                      .filter(Boolean)
                      .map((number) => numberName(number!))
                      .join(", ") || "—"
                  }
                  onEdit={() => goTo(0)}
                />
                <ReviewRow
                  label="Audience"
                  value={`${plural(reach, "private chat")} · ${plural(audience.waGroups.length, "group post")}`}
                  onEdit={() => goTo(0)}
                />
                <ReviewRow
                  label="Message"
                  value={content.trim() || "—"}
                  lines={3}
                  onEdit={() => goTo(1)}
                />
                {kept.length + files.length > 0 && (
                  <ReviewRow
                    label="Attachments"
                    value={[...kept, ...files].map((file) => file.name).join(", ")}
                    onEdit={() => goTo(1)}
                  />
                )}
                <ReviewRow
                  label="Send"
                  onEdit={() => goTo(2)}
                  value={
                    when === "now"
                      ? "Now"
                      : !start
                        ? "—"
                        : when === "later"
                          ? formatSchedule(start)
                          : `${
                              repeats === "DAILY"
                                ? every === 1
                                  ? "Every day"
                                  : `Every ${every} days`
                                : repeats === "WEEKLY"
                                  ? `Every ${every === 1 ? "" : `${every} weeks on `}${WEEK.filter(
                                      (item) => weekDays.includes(item.value),
                                    )
                                      .map((item) => item.short)
                                      .join(", ")}`
                                  : every === 1
                                    ? "Monthly"
                                    : `Every ${every} months`
                            } from ${formatSchedule(start)}${endDay ? `, until ${endDay.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}`
                  }
                />
              </View>
              {/* E09: contacts not saved on the sending WhatsApp account. Inline, with the choice to send anyway. */}
              {unsaved && (
                <View
                  role="alert"
                  className="gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4"
                >
                  <View className="flex-row items-center gap-2">
                    <CustomIcon as={TriangleAlert} size={18} className="text-warning-fg" />
                    <CustomText className="flex-1 font-sans-semibold text-[15px] text-warning-fg">
                      {plural(unsaved.length, "contact")}{" "}
                      {unsaved.length === 1 ? "isn't" : "aren't"} saved on your WhatsApp
                    </CustomText>
                  </View>
                  <CustomText className="text-[13px] leading-5 text-warning-fg">
                    Messages to unsaved numbers are more likely to be reported. Save them on the
                    phone first, or send anyway.
                  </CustomText>
                  <CustomText className="text-[13px] text-warning-fg">
                    {unsaved
                      .slice(0, 4)
                      .map((contact) => contact.name)
                      .join(", ")}
                    {unsaved.length > 4 ? ` and ${unsaved.length - 4} more` : ""}
                  </CustomText>
                  <View className="flex-row gap-2">
                    <CustomButton
                      size="sm"
                      loading={busy === "send"}
                      onPress={() => void save("send", true)}
                    >
                      Send anyway
                    </CustomButton>
                    <CustomButton
                      size="sm"
                      variant="ghost"
                      disabled={!!busy}
                      onPress={() => {
                        setUnsaved(null);
                        goTo(0);
                      }}
                    >
                      Edit audience
                    </CustomButton>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View className="gap-3 border-t border-ink-200 bg-card px-5 pb-4 pt-3">
          {error && (
            <CustomText role="alert" className="text-sm text-error-fg">
              {error}
            </CustomText>
          )}
          {step < 3 ? (
            <CustomButton
              size="xl"
              fullWidth
              disabled={!!busy}
              onPress={next}
              trailingIcon={
                <CustomIcon as={ArrowRight} size={18} className="text-primary-foreground" />
              }
            >
              Continue
            </CustomButton>
          ) : (
            <CustomButton
              size="xl"
              fullWidth
              loading={busy === "send"}
              loadingText={when === "now" ? "Sending…" : "Scheduling…"}
              disabled={!!busy && busy !== "send"}
              leadingIcon={
                <CustomIcon
                  as={when === "now" ? Send : when === "later" ? CalendarClock : Repeat}
                  size={18}
                  className="text-primary-foreground"
                />
              }
              onPress={() => void save("send")}
            >
              {sendLabel}
            </CustomButton>
          )}
          <CustomText className="text-center text-xs leading-5 text-ink-600">
            {step < 3
              ? "You can save a draft at any step."
              : when === "now"
                ? "It starts in a few seconds."
                : "You can pause or cancel it any time before it sends."}
          </CustomText>
        </View>
      </KeyboardScreen>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-2.5">
      <View className="gap-0.5">
        <CustomText className="font-sans-semibold text-[13px] text-ink-900">
          {label}
          {required && <CustomText className="text-error-fg"> *</CustomText>}
          {optional && <CustomText className="font-sans text-ink-600"> Optional</CustomText>}
        </CustomText>
        {!!hint && <CustomText className="text-[13px] leading-5 text-ink-600">{hint}</CustomText>}
      </View>
      {children}
      {!!error && (
        <CustomText role="alert" className="font-sans-medium text-[13px] text-error-fg">
          {error}
        </CustomText>
      )}
    </View>
  );
}

/** A "When" option as a card, as onboarding's choices and the web's radio cards. */
function Choice({
  icon,
  label,
  hint,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      role="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${hint}`}
      onPress={onPress}
      className={cn(
        "min-h-[68px] flex-row items-center gap-3 rounded-2xl border p-3.5",
        selected ? "border-primary bg-brand-50" : "border-border bg-card active:bg-accent",
      )}
    >
      <View
        className={cn(
          "h-10 w-10 items-center justify-center rounded-xl",
          selected ? "bg-primary" : "bg-accent",
        )}
      >
        <CustomIcon
          as={icon}
          size={18}
          className={selected ? "text-primary-foreground" : "text-ink-700"}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <CustomText className="font-sans-semibold text-[15px]">{label}</CustomText>
        <CustomText className="text-xs leading-4 text-muted-foreground">{hint}</CustomText>
      </View>
      <View
        className={cn(
          "h-5 w-5 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-ink-300",
        )}
      >
        {selected && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </View>
    </MotionPressable>
  );
}

function Stepper({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:bg-accent"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <CustomIcon as={icon} size={17} className="text-foreground" />
    </MotionPressable>
  );
}

function ReviewRow({
  label,
  value,
  lines = 2,
  first,
  onEdit,
}: {
  label: string;
  value: string;
  lines?: number;
  first?: boolean;
  onEdit: () => void;
}) {
  return (
    <View
      className={cn("flex-row items-start gap-3 px-4 py-3.5", !first && "border-t border-border")}
    >
      <CustomText className="w-[78px] pt-px text-[13px] text-muted-foreground">{label}</CustomText>
      <CustomText
        numberOfLines={lines}
        className="min-w-0 flex-1 font-sans-medium text-[14px] leading-5"
      >
        {value}
      </CustomText>
      <MotionPressable
        role="button"
        accessibilityLabel={`Edit ${label.toLowerCase()}`}
        onPress={onEdit}
        hitSlop={8}
      >
        <CustomText className="font-sans-semibold text-[13px] text-primary">Edit</CustomText>
      </MotionPressable>
    </View>
  );
}

function Tick({ checked }: { checked: boolean }) {
  return (
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
  );
}

/** A draft being opened from the list: close, and a spinner, or why it couldn't open. */
function DraftOpening({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-ink-50">
      <View className="min-h-11 flex-row items-center gap-2 border-b border-ink-200 bg-card px-5 pb-3 pt-2">
        <MotionPressable
          role="button"
          accessibilityLabel="Close"
          onPress={goBack}
          className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-accent"
        >
          <CustomIcon as={X} size={22} className="text-foreground" />
        </MotionPressable>
        <CustomText className="flex-1 font-sans-semibold text-base">Draft</CustomText>
      </View>
      <View className="flex-1 items-center justify-center gap-3 p-6">
        {error ? (
          <>
            <CustomText role="alert" className="text-center text-sm text-error-fg">
              {error}
            </CustomText>
            <CustomButton variant="link" onPress={onRetry}>
              Try again
            </CustomButton>
          </>
        ) : (
          <CustomSpinner accessibilityLabel="Opening the draft" />
        )}
      </View>
    </SafeAreaView>
  );
}
