import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Check, Smartphone } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { useAppSelector } from "@/store/hooks";
import { useMessaging } from "../providers/messaging-provider";
import { isConnected } from "../types";

export function ConnectNumberScreen() {
  const { sessionId: existingId } = useLocalSearchParams<{ sessionId?: string }>();
  const { api, numbers, refreshNumbers, selectNumber } = useMessaging();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const existing = numbers.find((number) => number.id === existingId);
  const [phone, setPhone] = useState(existing?.phoneNumber ? `+${existing.phoneNumber.replace(/^\+/, "")}` : "");
  const [name, setName] = useState(existing?.displayName ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const sessionId = useRef(existingId ?? null);
  const pending = useRef(false);
  const alive = useRef(true);
  useFocusEffect(useCallback(() => { alive.current = true; return () => { alive.current = false; }; }, []));
  useFocusEffect(useCallback(() => {
    if (!code || !sessionId.current) return;
    let cancelled = false;
    let checking = false;
    let checks = 0;
    const timer = setInterval(async () => {
      if (cancelled || checking || AppState.currentState !== "active") return;
      checking = true;
      const rows = await refreshNumbers();
      checking = false;
      if (cancelled) return;
      const linked = rows.find((number) => number.id === sessionId.current && isConnected(number));
      if (linked) { selectNumber(linked.id); setConnected(true); clearInterval(timer); }
      else if (++checks >= 40) { setExpired(true); clearInterval(timer); }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [code, refreshNumbers, selectNumber]));

  async function connect() {
    if (pending.current) return;
    const parsed = parsePhoneNumberFromString(phone.trim());
    if (!parsed?.isValid()) { setError("Enter a valid phone number with its country code, for example +91 98765 43210."); return; }
    pending.current = true; setBusy(true); setError(null); setExpired(false);
    try {
      if (!sessionId.current) {
        const result = await api.addNumber();
        if (!result.ok) { if (alive.current) setError(result.message || "Couldn't add your number. Try again."); return; }
        sessionId.current = result.data.id;
      }
      if (name.trim()) {
        const renamed = await api.renameNumber(sessionId.current, name.trim());
        if (!renamed.ok) { if (alive.current) setError(renamed.message || "Couldn't save the number's name. Try again."); return; }
      }
      const result = await api.pairingCode(sessionId.current, parsed.number);
      if (!alive.current) return;
      if (!result.ok) { setError(result.message || "Couldn't get a linking code. Try again."); return; }
      setCode(result.data.code);
      void refreshNumbers();
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  if (existing && existing.userId !== userId) return <View className="flex-1 bg-card"><ScreenHeader title="Reconnect number" />
    <View className="p-5"><CustomAlert tone="warning">Only the teammate who added this number can reconnect it. Ask them to open WhatsApp numbers.</CustomAlert></View></View>;
  return <KeyboardAvoidingView className="flex-1 bg-card" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScreenHeader title={connected ? "Number connected" : existing?.phoneNumber ? "Reconnect number" : "Connect a number"} />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerClassName="gap-6 p-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50"><CustomIcon as={connected ? Check : Smartphone} size={30} className="text-primary" /></View>
      {connected ? <>
        <CustomText className="font-sans-semibold text-2xl">You’re connected</CustomText>
        <CustomText className="text-sm leading-6 text-muted-foreground">Your WhatsApp chats will start syncing. You can switch between your numbers at any time.</CustomText>
        <CustomButton size="xl" onPress={() => router.replace("/inbox")}>Open chats</CustomButton>
      </> : <>
        <View className="gap-2"><CustomText className="font-sans-semibold text-2xl">Your WhatsApp, in Roklo</CustomText>
          <CustomText className="text-sm leading-6 text-muted-foreground">Enter your business number. We’ll give you a code to link it from WhatsApp.</CustomText></View>
        {error && <CustomAlert tone="error">{error}</CustomAlert>}
        {!code ? <>
          <CustomFormField id="link-phone" label="WhatsApp number" help="Include your country code." required>
            {(control) => <CustomInput {...control} size="xl" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="+91 98765 43210" editable={!busy} />}
          </CustomFormField>
          <CustomFormField id="link-name" label="Name this number" help="Optional. Helps your team recognize it.">
            {(control) => <CustomInput {...control} size="xl" value={name} onChangeText={setName} maxLength={60} placeholder="e.g. Sales or Support" editable={!busy} />}
          </CustomFormField>
          <CustomButton size="xl" fullWidth loading={busy} loadingText="Getting your code…" onPress={() => void connect()}>Get linking code</CustomButton>
        </> : <>
          <View className="gap-3 rounded-xl border border-border bg-accent p-5">
            <CustomText className="text-xs text-muted-foreground">YOUR LINKING CODE</CustomText>
            <CustomText selectable className="font-mono text-[28px] tracking-[4px] text-primary">{code.replace(/(.{4})(?=.)/g, "$1 ")}</CustomText>
          </View>
          <View className="gap-4"><CustomText className="text-sm leading-6">1. Open WhatsApp on the phone with this number.</CustomText>
            <CustomText className="text-sm leading-6">2. Open Settings or Menu → Linked devices → Link a device.</CustomText>
            <CustomText className="text-sm leading-6">3. Choose “Link with phone number instead” and enter this code.</CustomText></View>
          <CustomAlert tone={expired ? "warning" : "info"}>{expired ? "Still waiting for a connection. If the code expired, get a new one." : "Waiting for you to enter the code in WhatsApp…"}</CustomAlert>
          <CustomButton variant="secondary" size="xl" loading={busy} onPress={() => void connect()}>Get a new code</CustomButton>
          <CustomButton variant="ghost" size="xl" onPress={() => { setCode(""); setExpired(false); }}>Edit number</CustomButton>
        </>}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
