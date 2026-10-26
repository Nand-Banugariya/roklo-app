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
import { cn } from "@/lib/utils";

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
      hero={(keyboardVisible) => <AuthCarousel compact={keyboardVisible} />}
    >
      {/* A card on the bottom edge; it pads the home-indicator inset itself. */}
      {(_reveal, keyboardVisible) => (
        <View
          // With the keyboard open the card tightens up (like the reference),
          // so the whole Send code button fits above the keyboard.
          className={cn(
            "-mx-2 rounded-t-[28px] border border-b-0 border-border bg-card px-6",
            keyboardVisible ? "gap-3 pt-5" : "gap-6 pt-7",
          )}
          style={{ paddingBottom: keyboardVisible ? 12 : insets.bottom + 24 }}
        >
          {/* Keyboard open: the card runs down behind it, so no gap shows. */}
          {keyboardVisible && (
            <View
              pointerEvents="none"
              className="absolute -left-px -right-px top-full h-[900px] border-x border-border bg-card"
            />
          )}
          <CustomFormField
            id="phone"
            required
            size="lg"
            error={form.phoneError}
          >
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
          <CustomText
            className={cn(
              "text-[13px] leading-5 text-ink-600",
              keyboardVisible ? "-mt-1" : "-mt-2",
            )}
          >
            By continuing, you agree to Roklo’s{" "}
            <Link href={`${env.webUrl}/terms`} asChild>
              <CustomText className="text-[13px] text-brand-700 underline">
                Terms of Service
              </CustomText>
            </Link>{" "}
            and{" "}
            <Link href={`${env.webUrl}/privacy`} asChild>
              <CustomText className="text-[13px] text-brand-700 underline">
                Privacy Policy
              </CustomText>
            </Link>
            .
          </CustomText>
          <CustomCaptcha
            resetKey={form.captchaKey}
            onToken={form.setCaptchaToken}
          />
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
      )}
    </AuthLayout>
  );
}
