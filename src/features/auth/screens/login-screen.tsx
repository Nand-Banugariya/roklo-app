import { Link } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomCaptcha } from "@/components/shadcn-custom/customcaptcha";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomPhoneInput } from "@/components/shadcn-custom/customphoneinput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { env } from "@/config/env";

import { AuthCarousel } from "../components/auth-carousel";
import { AuthLayout } from "../components/auth-layout";
import { useCountdown } from "../hooks/use-countdown";
import { useSignIn } from "../providers/sign-in-provider";

export default function LoginScreen() {
  const form = useSignIn();
  const seconds = useCountdown(form.sendBlockedUntil);
  const insets = useSafeAreaInsets();
  // The keyboard scrolls this into view so Send code is never covered.
  const sendButton = useRef<View>(null);
  return (
    <AuthLayout
      focusTargetRef={sendButton}
      tinted
      scrollable={false}
      showHelp={false}
      hero={<AuthCarousel />}
    >
      {/* A card on the bottom edge; it pads the home-indicator inset itself. With the keyboard open the
          page slides up as one (see AuthLayout), so nothing here changes size while it moves. */}
      <View
        className="-mx-2 gap-6 rounded-t-[28px] border border-b-0 border-border bg-card px-6 pt-7"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Runs on down below the card, so no gap shows above the keyboard as the page slides. */}
        <View
          pointerEvents="none"
          className="absolute -left-px -right-px top-full h-[900px] border-x border-border bg-card"
        />
        <CustomFormField id="phone" required size="lg" error={form.phoneError}>
          {(control) => (
            <CustomPhoneInput
              {...control}
              accessibilityLabel="Mobile number"
              variant="auth"
              country={form.countryCode}
              onCountryChange={form.changeCountry}
              value={form.phone}
              onValueChange={form.changePhone}
              placeholder="98765 43210"
              invalid={!!form.phoneError}
              disabled={!!form.busy}
              returnKeyType="done"
              onSubmitEditing={() => void form.requestCode()}
            />
          )}
        </CustomFormField>
        <CustomText className="-mt-2 text-[13px] leading-5 text-ink-600">
          By continuing, you agree to Roklo’s{" "}
          <Link href={`${env.webUrl}/terms`} asChild>
            <CustomText className="text-[13px] text-brand-700 underline">
              Terms of Service
            </CustomText>
          </Link>{" "}
          and{" "}
          <Link href={`${env.webUrl}/privacy`} asChild>
            <CustomText className="text-[13px] text-brand-700 underline">Privacy Policy</CustomText>
          </Link>
          .
        </CustomText>
        <CustomCaptcha resetKey={form.captchaKey} onToken={form.setCaptchaToken} />
        <View ref={sendButton} collapsable={false}>
          <CustomButton
            size="xl"
            fullWidth
            loading={form.busy === "send"}
            loadingText="Sending code"
            disabled={seconds > 0}
            onPress={() => void form.requestCode()}
          >
            {seconds > 0 ? `Try again in ${seconds}s` : "Send code"}
          </CustomButton>
        </View>
      </View>
    </AuthLayout>
  );
}
