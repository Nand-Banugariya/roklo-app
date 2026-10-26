import { Redirect, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { BackHandler, View } from "react-native";

import { CustomBackButton } from "@/components/shadcn-custom/custombackbutton";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomOTPInput } from "@/components/shadcn-custom/customotpinput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { getCountry } from "@/lib/auth/countries";
import { formatCountdown, formatPhone, OTP_LENGTH } from "@/lib/auth/phone";

import { AuthHeader } from "../components/auth-header";
import { AuthLayout } from "../components/auth-layout";
import { useCountdown } from "../hooks/use-countdown";
import { useSignIn } from "../providers/sign-in-provider";

export default function VerifyOtpScreen() {
  const form = useSignIn();
  const otpSection = useRef<View>(null);
  const seconds = useCountdown(form.challenge?.resendAvailableAt ?? 0);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          form.backFromCode();
          return true;
        },
      );
      return () => subscription.remove();
    }, [form]),
  );
  const challenge = form.challenge;
  if (!challenge) return <Redirect href="/login" />;
  const isEmail = challenge.channel === "email";
  const sentTo = isEmail
    ? challenge.email
    : // Non-breaking spaces keep the whole number together on one line.
      `${getCountry(form.countryCode).dial} ${formatPhone(form.phone, form.countryCode)}`.replace(
        / /g,
        "\u00A0",
      );
  return (
    <AuthLayout focusTargetRef={otpSection} cornerLogo>
      {(reveal) => (
        <View className="gap-7">
          <CustomBackButton disabled={!!form.busy} onPress={form.backFromCode}>
            {isEmail ? "Use a different email" : "Use a different number"}
          </CustomBackButton>
          <AuthHeader title={isEmail ? "Check your email" : "Enter your code"}>
            {isEmail
              ? "We emailed a 6-digit code to "
              : "We sent a 6-digit code by SMS to "}
            <CustomText className="font-sans-semibold text-[15px] text-ink-900">
              {sentTo}
            </CustomText>
            .
          </AuthHeader>
          <View ref={otpSection} collapsable={false} className="gap-7">
            <View className="gap-3">
              <CustomFormField
                id="otp"
                required
                size="lg"
                label="Verification code"
                error={form.codeError}
                className="gap-3"
              >
                {(control) => (
                  <CustomOTPInput
                    {...control}
                    key={`${challenge.otpRef}-${form.inputAttempt}`}
                    autoFocus
                    onFocus={reveal}
                    length={OTP_LENGTH}
                    value={form.code}
                    onValueChange={form.changeCode}
                    onComplete={(value) => void form.verify(value)}
                    invalid={!!form.codeError}
                    disabled={!!form.busy}
                    channel={challenge.channel}
                  />
                )}
              </CustomFormField>
              <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
                <CustomText className="text-[13px] text-ink-700">
                  Didn’t get it?{seconds > 0 ? " You can resend in" : ""}
                </CustomText>
                {seconds > 0 ? (
                  <CustomText className="font-sans-semibold text-[13px] text-ink-900">
                    {formatCountdown(seconds)}
                  </CustomText>
                ) : (
                  <CustomButton
                    variant="link"
                    size="sm"
                    disabled={!!form.busy}
                    onPress={() => void form.resend()}
                  >
                    {form.busy === "resend" ? "Sending…" : "Resend code"}
                  </CustomButton>
                )}
                {form.resent && (
                  <CustomText
                    accessibilityLiveRegion="polite"
                    className="font-sans-medium text-[13px] text-brand-600"
                  >
                    · New code sent
                  </CustomText>
                )}
              </View>
            </View>
            <CustomButton
              size="xl"
              fullWidth
              loading={form.busy === "verify"}
              loadingText="Verifying"
              disabled={
                form.code.length !== OTP_LENGTH || form.busy === "resend"
              }
              onPress={() => void form.verify(form.code)}
            >
              Verify
            </CustomButton>
          </View>
        </View>
      )}
    </AuthLayout>
  );
}
