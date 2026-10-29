import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  CircleCheck,
  Copy,
  Globe,
  Lock,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomPhoneInput } from "@/components/shadcn-custom/customphoneinput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { DEFAULT_COUNTRY_CODE, getCountry } from "@/lib/auth/countries";
import { formatPhone, invalidPhoneMessage, isValidPhone, sanitizePhone } from "@/lib/auth/phone";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { VisibilityForm } from "../components/visibility-form";
import { useRealtimeEvent } from "../hooks/use-realtime-event";
import { useMessaging } from "../providers/messaging-provider";
import { JOINED_EVENT } from "../services/realtime";
import { isConnected, type NumberVisibility, type WhatsAppNumber } from "../types";

/** The name onboarding gives the first number; shown empty so it gets renamed. */
const DEFAULT_NAME = "Default Connection";
const LOAD_ERROR = "We couldn’t set up a new number. Please try again.";
const RELINK_ERROR = "We couldn’t find this number. It may have been removed.";
const NOT_OWNER_ERROR = "Only the person who added this number can reconnect it.";
/** Polling is the fallback for missed socket events; after this many checks (~2 min) the code may have expired. */
const POLL_MS = 3000;
const SLOW_AFTER = 40;
/** "How old is this number?": the API sets the daily sending limit from it. */
const AGE_OPTIONS = [
  { label: "1–3 days old", hint: "Brand new number", days: 3 },
  { label: "4–7 days old", hint: "Just getting started", days: 7 },
  { label: "8–14 days old", hint: "Early stage", days: 14 },
  { label: "15–30 days old", hint: "Getting established", days: 30 },
  { label: "More than 30 days", hint: "Established number", days: 31 },
] as const;
const VISIBILITY: Record<NumberVisibility, { label: string; icon: LucideIcon }> = {
  ME_ONLY: { label: "Only me", icon: Lock },
  TEAM: { label: "Teams and people", icon: Users },
  EVERYONE: { label: "Everyone", icon: Globe },
};

/**
 * form: number to link · code: waiting for it on the phone · linking: entered, syncing ·
 * rejected: WhatsApp linked, but the API refused that number.
 */
type LinkState = "form" | "code" | "linking" | "connected" | "expired" | "rejected";
/** What the API's socket relays about a number (WAHA webhooks). */
interface SessionEvent {
  session?: string;
  sessionId?: string;
  status?: string;
}
/** `added`: this screen created it, so leaving before a code removes it again. `online`: a relink already back. */
type Target = { id: string; added: boolean; online?: boolean } | { error: string };

const linked = (number: WhatsAppNumber | undefined) =>
  !!number && (number.isWhatsAppConnected || isConnected(number));
/** "+919876543210" → { country: "in", phone: "9876543210" }, for the phone field's two parts. */
function splitNumber(e164: string | null | undefined) {
  const parsed = e164 ? parsePhoneNumberFromString(`+${e164.replace(/^\+/, "")}`) : undefined;
  if (!parsed?.country) return null;
  const country = parsed.country.toLowerCase();
  return { country, phone: sanitizePhone(String(parsed.nationalNumber), country) };
}
const pretty = (e164: string | null | undefined) => {
  if (!e164) return "";
  const value = `+${e164.replace(/^\+/, "")}`;
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
};

/**
 * Link a WhatsApp number by phone number and linking code, as the web app's "Connect WhatsApp" (never by QR).
 * Relinks `sessionId` when given, else reuses the caller's never-linked number or adds a new one.
 */
export function ConnectNumberScreen() {
  const { sessionId: relinkId } = useLocalSearchParams<{ sessionId?: string }>();
  const { api, numbers, refreshNumbers, selectNumber } = useMessaging();
  const user = useAppSelector((state) => state.auth.user);

  // ── The number to link ─────────────────────────────────────────────────
  const [target, setTarget] = useState<{ id: string; added: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  // Held so a second effect run doesn't add a second number.
  const finding = useRef<Promise<Target> | null>(null);
  const number = numbers.find((row) => row.id === target?.id);
  function retryLoad() {
    finding.current = null;
    setLoadError(null);
    setLoadKey((key) => key + 1);
  }

  // ── Link state ─────────────────────────────────────────────────────────
  const [state, setState] = useState<LinkState>("form");
  // Read by socket handlers and async steps, which outlive a render.
  const stateRef = useRef<LinkState>("form");
  const moveTo = useCallback((next: LinkState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const [rejection, setRejection] = useState<{ title: string; message: string } | null>(null);
  const reject = useCallback(
    (title: string, message: string) => {
      setRejection({ title, message });
      moveTo("rejected");
    },
    [moveTo],
  );
  const [ageNeeded, setAgeNeeded] = useState<boolean | null>(null);
  /** Linked: select it, and ask its age while unknown (no `session.ready` answer, or an older API). */
  const finish = useCallback(
    async (id: string) => {
      moveTo("connected");
      const current = (await refreshNumbers()).find((row) => row.id === id);
      if (current) selectNumber(current.id);
      setAgeNeeded((known) => known ?? (current ? current.numberAgeAtConnection == null : false));
    },
    [moveTo, refreshNumbers, selectNumber],
  );

  useEffect(() => {
    let cancelled = false;
    finding.current ??= (async (): Promise<Target> => {
      const rows = await refreshNumbers();
      if (relinkId) {
        const relink = rows.find((row) => row.id === relinkId);
        if (!relink) return { error: RELINK_ERROR };
        // The API refuses anyone else a code (403), which would read as a broken one.
        return relink.userId !== user?.id
          ? { error: NOT_OWNER_ERROR }
          : { id: relink.id, added: false, online: linked(relink) };
      }
      // A number linked before stays bound to its phone, so only a never-linked one is reused.
      const unlinked = rows.find(
        (row) => !row.phoneNumber && !linked(row) && row.userId === user?.id,
      );
      if (unlinked) return { id: unlinked.id, added: false };
      const added = await api.addNumber();
      if (!added.ok) return { error: added.message || LOAD_ERROR };
      await refreshNumbers();
      return { id: added.data.id, added: true };
    })();
    void finding.current.then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setTarget(result);
      if (result.online) void finish(result.id);
    });
    return () => {
      cancelled = true;
    };
  }, [api, refreshNumbers, relinkId, user?.id, loadKey, finish]);

  // ── Name ───────────────────────────────────────────────────────────────
  const [nameInput, setName] = useState<string | null>(null);
  const name =
    nameInput ??
    (number?.displayName && number.displayName !== DEFAULT_NAME ? number.displayName : "");
  const [editingVisibility, setEditingVisibility] = useState(false);
  async function saveName() {
    const displayName = name.trim();
    if (!number || !displayName || displayName === number.displayName) return;
    const result = await api.renameNumber(number.id, displayName);
    if (result.ok) void refreshNumbers();
  }

  // ── Phone and code ─────────────────────────────────────────────────────
  // Until edited it shows the number this was linked to before (a relink), else the one they signed in with.
  // Country and national digits, as on the login page.
  const suggested = splitNumber(number?.phoneNumber || user?.mobileNumber);
  const [countryInput, setCountry] = useState<string | null>(null);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const country = countryInput ?? suggested?.country ?? DEFAULT_COUNTRY_CODE;
  const phone = phoneInput ?? suggested?.phone ?? "";
  const dial = getCountry(country).dial;
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRequested = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function getCode() {
    if (!target || requesting) return;
    if (!isValidPhone(phone, country)) {
      setPhoneError(invalidPhoneMessage(country));
      return;
    }
    setRequesting(true);
    setPhoneError(null);
    setRejection(null);
    setSlow(false);
    await saveName();
    const result = await api.pairingCode(target.id, `${dial}${phone}`);
    if (!alive.current) return;
    setRequesting(false);
    // Back to step 1 with the error, rather than leaving an old code on screen.
    if (!result.ok) {
      setPhoneError(result.message || "We couldn’t get a code. Please try again.");
      setCode(null);
      moveTo("form");
      return;
    }
    codeRequested.current = true;
    setCode(result.data.code);
    setEditingVisibility(false);
    moveTo("code");
  }
  function changeNumber() {
    setCode(null);
    setSlow(false);
    moveTo("form");
  }
  async function copyCode() {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => alive.current && setCopied(false), 2000);
    } catch {
      /* The code is on screen to type by hand. */
    }
  }

  // Left before linking began (no code asked for): a number this screen added is removed, so it
  // doesn't stay behind as "Not linked". A never-linked one is reused next time anyway.
  // Kept current each render; run once, on leaving.
  const leave = useRef(() => {});
  useEffect(() => {
    leave.current = () => {
      if (target?.added && !codeRequested.current && stateRef.current !== "connected")
        void api.removeNumber(target.id).then(() => refreshNumbers());
    };
  });
  useEffect(() => () => leave.current(), []);

  // ── Waiting for the phone ──────────────────────────────────────────────
  const waiting = state === "code" || state === "linking";
  const checkNow = useCallback(async () => {
    if (!target) return;
    const current = (await refreshNumbers()).find((row) => row.id === target.id);
    if (linked(current) && (stateRef.current === "code" || stateRef.current === "linking"))
      void finish(target.id);
  }, [target, refreshNumbers, finish]);
  // A fallback for when no socket event arrives; paused in the background.
  useFocusEffect(
    useCallback(() => {
      if (!waiting) return;
      let checks = 0;
      let checking = false;
      const timer = setInterval(() => {
        if (checking || AppState.currentState !== "active") return;
        checking = true;
        void checkNow().finally(() => {
          checking = false;
        });
        if (++checks === SLOW_AFTER) setSlow(true);
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [waiting, checkNow]),
  );

  // WAHA's webhooks, relayed by the API's socket, move the screen along.
  const live = !!target && state !== "connected";
  const isThisNumber = (event: SessionEvent | undefined) =>
    !!event &&
    !!target &&
    (event.sessionId === target.id ||
      (!!number?.sessionName && event.session === number.sessionName));
  useRealtimeEvent(
    JOINED_EVENT,
    () => {
      if (waiting) void checkNow();
    },
    live,
  );
  useRealtimeEvent<SessionEvent & { needsAgePrompt?: boolean }>(
    "session.ready",
    (event) => {
      if (!isThisNumber(event) || !target) return;
      if (typeof event.needsAgePrompt === "boolean") setAgeNeeded(event.needsAgePrompt);
      void finish(target.id);
    },
    !!target,
  );
  useRealtimeEvent<SessionEvent>(
    "session.status",
    (event) => {
      if (!isThisNumber(event) || !target || stateRef.current === "rejected") return;
      if (event.status === "WORKING" || event.status === "CONNECTED") void finish(target.id);
      else if (event.status === "STARTING" && stateRef.current === "code") moveTo("linking");
      // Not STOPPED: the API reports it late and restarts the session itself.
      else if (
        event.status === "FAILED" &&
        (stateRef.current === "code" || stateRef.current === "linking")
      )
        moveTo("expired");
    },
    live,
  );
  useRealtimeEvent<SessionEvent & { phoneNumber?: string }>(
    "session.duplicate_number",
    (event) => {
      if (!isThisNumber(event)) return;
      reject(
        "Number already in use",
        `${event.phoneNumber ? pretty(event.phoneNumber) : "This number"} is already connected to Roklo on another account. Link a different WhatsApp number.`,
      );
    },
    live,
  );
  useRealtimeEvent<SessionEvent & { boundPhoneNumber?: string | null }>(
    "session.number_locked",
    (event) => {
      if (!isThisNumber(event)) return;
      reject(
        "Wrong number",
        `This connection belongs to ${event.boundPhoneNumber ? pretty(event.boundPhoneNumber) : "another number"}. Link it from that phone.`,
      );
    },
    live,
  );

  // ── Number age, after linking ──────────────────────────────────────────
  const [ageDays, setAgeDays] = useState<number | null>(null);
  const [savingAge, setSavingAge] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  async function saveAge() {
    if (!target || ageDays === null || savingAge) return;
    setSavingAge(true);
    setAgeError(null);
    const result = await api.setNumberAge(target.id, ageDays);
    if (!alive.current) return;
    setSavingAge(false);
    if (result.ok) {
      setAgeNeeded(false);
      void refreshNumbers();
    } else setAgeError(result.message || "Couldn't save the number's age. Try again.");
  }

  const connected = state === "connected";
  // Step 1 is the form; a code on screen (or anything after it) is step 2. "Change" goes back.
  // The same test the card uses to pick what it shows, so the chip can't disagree with it.
  const firstStep = state === "form" && !code;
  const relinking = !!relinkId;
  const panel = loadError ? (
    <View className="items-center gap-3 py-4">
      <CustomText className="text-center font-sans-semibold text-error-fg">
        {relinking ? "Couldn’t reconnect this number" : "Couldn’t add a number"}
      </CustomText>
      <CustomText className="max-w-72 text-center text-[13px] leading-5 text-muted-foreground">
        {loadError}
      </CustomText>
      {/* Retrying can't change who added the number. */}
      {loadError !== NOT_OWNER_ERROR && (
        <CustomButton
          leadingIcon={<CustomIcon as={RefreshCw} size={16} className="text-primary-foreground" />}
          onPress={retryLoad}
        >
          Try again
        </CustomButton>
      )}
    </View>
  ) : !target ? (
    <View className="items-center gap-3 py-10">
      <CustomSpinner size="large" accessibilityLabel="Preparing your number" />
      <CustomText className="text-[13px] text-muted-foreground">Preparing your number…</CustomText>
    </View>
  ) : connected ? (
    <View className="items-center gap-4">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-100">
        <CustomIcon as={CircleCheck} size={28} className="text-primary" />
      </View>
      <View className="items-center gap-1">
        <CustomText className="font-sans-semibold text-[17px]">WhatsApp connected</CustomText>
        {!!number?.phoneNumber && (
          <CustomText className="font-mono text-[13px] text-muted-foreground">
            {pretty(number.phoneNumber)}
          </CustomText>
        )}
        <CustomText className="text-center text-[13px] text-muted-foreground">
          Last 30 days of chats are syncing in the background.
        </CustomText>
      </View>
      {ageNeeded === null ? (
        <CustomSpinner accessibilityLabel="Checking the number" />
      ) : ageNeeded ? (
        <View className="w-full gap-2.5">
          <View className="gap-0.5">
            <CustomText nativeID="number-age-label" className="font-sans-semibold text-sm">
              How old is this number?
            </CustomText>
            <CustomText className="text-xs leading-4 text-muted-foreground">
              New numbers start with a lower daily sending limit to keep them safe.
            </CustomText>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabelledBy="number-age-label"
            className="gap-1.5"
          >
            {AGE_OPTIONS.map((option) => {
              const selected = ageDays === option.days;
              return (
                <MotionPressable
                  key={option.days}
                  role="radio"
                  accessibilityState={{ checked: selected, disabled: savingAge }}
                  disabled={savingAge}
                  onPress={() => setAgeDays(option.days)}
                  className={cn(
                    "min-h-11 flex-row items-center justify-between gap-3 rounded-lg border px-3 py-2",
                    selected
                      ? "border-primary bg-brand-50"
                      : "border-border bg-card active:bg-accent",
                  )}
                >
                  <CustomText className="font-sans-medium text-[13px]">{option.label}</CustomText>
                  <CustomText className="text-xs text-muted-foreground">{option.hint}</CustomText>
                </MotionPressable>
              );
            })}
          </View>
          {ageError && (
            <CustomText role="alert" className="text-xs text-error-fg">
              {ageError}
            </CustomText>
          )}
          <CustomButton
            disabled={ageDays === null}
            loading={savingAge}
            loadingText="Saving"
            onPress={() => void saveAge()}
          >
            Save and continue
          </CustomButton>
        </View>
      ) : (
        <View className="w-full gap-2">
          <CustomButton size="lg" fullWidth onPress={() => router.replace("/inbox")}>
            Go to inbox
          </CustomButton>
          <CustomButton
            size="lg"
            variant="secondary"
            fullWidth
            onPress={() => router.replace({ pathname: "/settings", params: { section: "team" } })}
          >
            Invite your team
          </CustomButton>
        </View>
      )}
    </View>
  ) : state === "linking" ? (
    <View className="items-center gap-4 py-4">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
        <CustomSpinner size="large" />
      </View>
      <View className="items-center gap-1">
        <CustomText className="font-sans-semibold">Linking your number…</CustomText>
        <CustomText className="text-center text-[13px] text-muted-foreground">
          Syncing recent chats. Keep WhatsApp open on your phone.
        </CustomText>
      </View>
      <CustomButton variant="link" onPress={() => void checkNow()}>
        Taking too long? Check again
      </CustomButton>
    </View>
  ) : state === "expired" || (state === "rejected" && rejection) ? (
    <View className="items-center gap-3 py-4">
      <CustomText className="font-sans-semibold text-error-fg">
        {state === "expired" ? "Code expired" : rejection!.title}
      </CustomText>
      <CustomText className="max-w-72 text-center text-[13px] leading-5 text-muted-foreground">
        {state === "expired" ? "Get a new one when your phone is ready." : rejection!.message}
      </CustomText>
      <CustomButton
        loading={requesting}
        leadingIcon={<CustomIcon as={RefreshCw} size={16} className="text-primary-foreground" />}
        onPress={() => (state === "expired" ? void getCode() : changeNumber())}
      >
        {state === "expired" ? "Get a new code" : "Try again"}
      </CustomButton>
    </View>
  ) : code ? (
    <View className="items-center gap-4">
      <View className="items-center gap-1">
        <CustomText className="font-sans-semibold">Enter this code on your phone</CustomText>
        <View className="flex-row items-center">
          <CustomText className="text-[13px] text-muted-foreground">
            For {dial} {formatPhone(phone, country)} ·{" "}
          </CustomText>
          <CustomButton variant="link" size="sm" onPress={changeNumber} className="min-h-0 px-0">
            Change
          </CustomButton>
        </View>
      </View>
      <CodeBoxes code={code} />
      <CustomButton
        variant="secondary"
        size="sm"
        leadingIcon={<CustomIcon as={Copy} size={14} className="text-foreground" />}
        onPress={() => void copyCode()}
      >
        {copied ? "Copied" : "Copy code"}
      </CustomButton>
      <View className="flex-row items-center gap-2">
        <CustomSpinner size="small" />
        <CustomText className="text-[13px] text-muted-foreground">
          Waiting for your phone
        </CustomText>
      </View>
      {slow && (
        <View className="items-center gap-1">
          <CustomText className="text-center text-[13px] text-warning-fg">
            Still waiting. If the code expired, get a new one.
          </CustomText>
          <CustomButton
            variant="link"
            size="sm"
            loading={requesting}
            onPress={() => void getCode()}
          >
            Get a new code
          </CustomButton>
        </View>
      )}
      {/* Where to type it, still under the code. */}
      <View className="self-stretch">
        <LinkSteps />
      </View>
    </View>
  ) : (
    <View className="gap-4">
      {/* The name first, then the number. */}
      <CustomFormField
        id="connection-name"
        label="Name this number"
        help="Helps your team tell your numbers apart."
      >
        {(control) => (
          <CustomInput
            {...control}
            size="xl"
            value={name}
            onChangeText={setName}
            onBlur={() => void saveName()}
            maxLength={60}
            placeholder="e.g. Pune branch"
            editable={!requesting}
          />
        )}
      </CustomFormField>
      <CustomFormField
        id="pair-phone"
        label="WhatsApp number"
        required
        error={phoneError ?? undefined}
      >
        {/* The login page's phone field: the country picker, then the national number. */}
        {(control) => (
          <CustomPhoneInput
            {...control}
            variant="auth"
            country={country}
            disabled={requesting}
            invalid={!!phoneError}
            onCountryChange={(next) => {
              setCountry(next);
              setPhone(sanitizePhone(phone, next));
              setPhoneError(null);
            }}
            value={phone}
            onValueChange={(raw) => {
              setCountry(country);
              setPhone(sanitizePhone(raw, country));
              setPhoneError(null);
            }}
            placeholder="98xxx xxxxx"
          />
        )}
      </CustomFormField>
      <CustomButton
        size="lg"
        fullWidth
        loading={requesting}
        loadingText="Getting your code…"
        onPress={() => void getCode()}
      >
        Get code
      </CustomButton>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-card"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader
        title={connected ? "Number connected" : relinking ? "Reconnect number" : "Connect a number"}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-6 p-5 pb-10"
      >
        <View className="gap-3">
          {/* Step 1: name, number and visibility. Step 2: the code, linking and done. */}
          <View className="h-[22px] self-start justify-center rounded-md bg-muted px-2">
            <CustomText className="font-sans-medium text-xs text-ink-700">
              Step {firstStep ? 1 : 2} of 2
            </CustomText>
          </View>
          <CustomText
            role="heading"
            className="font-sans-semibold text-[26px] leading-8 tracking-[-0.5px]"
          >
            {relinking ? "Reconnect your WhatsApp" : "Connect a WhatsApp number"}
          </CustomText>
        </View>

        {/* The code (or its state) first, as the web dialog stacks it on phones. */}
        <View role="status" className="rounded-2xl border border-border bg-ink-50 p-5">
          {panel}
        </View>

        {!!number &&
          firstStep &&
          !loadError &&
          (editingVisibility ? (
            <View className="rounded-xl border border-border p-4">
              <VisibilityForm
                number={number}
                isOwner={number.userId === user?.id}
                onDone={() => setEditingVisibility(false)}
              />
            </View>
          ) : (
            <VisibilityRow
              visibility={number.visibility ?? "ME_ONLY"}
              onChange={() => setEditingVisibility(true)}
            />
          ))}

        <View className="flex-row gap-2.5 rounded-[10px] bg-ink-50 px-3.5 py-3">
          <CustomIcon as={ShieldCheck} size={16} className="mt-px text-brand-600" />
          <CustomText className="flex-1 text-[13px] leading-5 text-ink-700">
            Your number stays on your phone. You can unlink Roklo anytime from WhatsApp numbers.
          </CustomText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** WhatsApp's own steps for a linking code. */
function LinkSteps() {
  return (
    <View className="gap-3 border-t border-border pt-4" accessibilityLabel="How to link">
      <Step index={1}>Open WhatsApp on the phone with your business number.</Step>
      <Step index={2}>
        Go to <CustomIcon as={Settings} size={14} className="text-ink-700" /> Settings, then Linked
        devices.
      </Step>
      <Step index={3}>Tap Link a device, then Link with phone number instead.</Step>
    </View>
  );
}

function Step({ index, children }: { index: number; children: ReactNode }) {
  return (
    <View className="flex-row gap-3">
      <View className="h-[26px] w-[26px] items-center justify-center rounded-full border border-border">
        <CustomText className="font-sans-semibold text-xs">{index}</CustomText>
      </View>
      <CustomText className="flex-1 pt-0.5 text-sm leading-5">{children}</CustomText>
    </View>
  );
}

function VisibilityRow({
  visibility,
  onChange,
}: {
  visibility: NumberVisibility;
  onChange: () => void;
}) {
  const { label, icon } = VISIBILITY[visibility];
  return (
    <View className="gap-1.5">
      <CustomText className="font-sans-medium text-sm">Visibility</CustomText>
      <MotionPressable
        role="button"
        accessibilityLabel={`Visibility: ${label}. Change`}
        onPress={onChange}
        className="min-h-12 flex-row items-center gap-3 rounded-lg border border-input bg-card px-3 active:bg-accent"
      >
        <CustomIcon as={icon} size={17} className="text-muted-foreground" />
        <CustomText className="flex-1 text-[15px]">{label}</CustomText>
        <CustomText className="font-sans-medium text-sm text-primary">Change</CustomText>
      </MotionPressable>
    </View>
  );
}

/** The 8-character code in boxes, "ABCD–EFGH", as the web dialog shows it. */
function CodeBoxes({ code }: { code: string }) {
  const chars = code
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase()
    .split("");
  const half = chars.length === 8 ? 4 : -1;
  return (
    <View
      accessibilityLabel={`Code ${chars.join(" ")}`}
      accessible
      className="flex-row items-center gap-1"
    >
      {chars.map((char, index) => (
        <View key={index} className="flex-row items-center gap-1">
          {index === half && <CustomText className="px-0.5 text-xl text-ink-400">–</CustomText>}
          <View className="h-[42px] w-8 items-center justify-center rounded-lg border border-border bg-card">
            <CustomText selectable className="font-mono text-xl">
              {char}
            </CustomText>
          </View>
        </View>
      ))}
    </View>
  );
}
