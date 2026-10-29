import { Check } from "lucide-react-native";
import { useRef, useState } from "react";
import { Keyboard, View } from "react-native";

import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomOTPInput } from "@/components/shadcn-custom/customotpinput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useCountdown } from "@/features/auth/hooks/use-countdown";
import { FULL_NAME_MAX } from "../../constants";
import type { useOnboarding } from "../../hooks/use-onboarding";
import { isValidEmail, stripEmailAlias } from "../../utils/validation";
import { useSetupFocus } from "../setup-layout";
import { StepHeader } from "../step-header";

type Flow = ReturnType<typeof useOnboarding>;
export function AboutYouStep({ flow }: { flow: Flow }) {
  const nameSection = useRef<View>(null);
  const emailSection = useRef<View>(null);
  const reveal = useSetupFocus();
  const seconds = useCountdown(flow.email.retryAvailableAt);
  const pending = flow.email.status === "sending" || flow.email.status === "verifying";
  const verified = flow.answers.emailVerified;
  return (
    <View className="gap-7">
      <StepHeader
        title="Tell us about you"
        description="Your teammates will see your name on chats you handle."
      />
      <View ref={nameSection} collapsable={false}>
        <CustomFormField id="full-name" label="Full name" required size="lg">
          {(control) => (
            <CustomInput
              {...control}
              size="xl"
              value={flow.answers.name}
              onChangeText={(name) => flow.updateAnswers({ name })}
              placeholder="e.g. Priya Sharma"
              maxLength={FULL_NAME_MAX}
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              onFocus={() => reveal(nameSection)}
            />
          )}
        </CustomFormField>
      </View>
      <View ref={emailSection} collapsable={false} className="gap-3">
        <CustomFormField
          id="work-email"
          label="Work email"
          optional
          size="lg"
          help={
            verified ? undefined : "For invoices and alerts. Verify this email, or leave it empty."
          }
          error={!flow.email.otpRef ? flow.email.error : null}
        >
          {(control) => (
            <CustomInput
              {...control}
              size="xl"
              value={flow.answers.email}
              onChangeText={(email) => flow.updateAnswers({ email })}
              placeholder="you@business.com"
              maxLength={150}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              onFocus={() => reveal(emailSection)}
            />
          )}
        </CustomFormField>
        {verified ? (
          <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <CustomIcon as={Check} size={16} className="text-brand-700" />
            <CustomText className="font-sans-medium text-[13px] text-brand-700">
              Email verified
            </CustomText>
          </View>
        ) : flow.email.otpRef ? (
          <EmailCode key={flow.email.otpRef} flow={flow} seconds={seconds} />
        ) : flow.answers.email.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-3">
            <CustomButton
              variant="secondary"
              size="lg"
              className="min-h-11"
              loading={flow.email.status === "sending"}
              loadingText="Sending code…"
              disabled={!isValidEmail(flow.answers.email) || seconds > 0}
              onPress={() => void flow.requestEmailCode()}
            >
              {seconds > 0 ? `Send code in ${seconds}s` : "Verify email"}
            </CustomButton>
            <CustomButton
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onPress={() => flow.updateAnswers({ email: "" })}
            >
              Clear email
            </CustomButton>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function EmailCode({ flow, seconds }: { flow: Flow; seconds: number }) {
  const [code, setCode] = useState("");
  const section = useRef<View>(null);
  const reveal = useSetupFocus();
  const verifying = flow.email.status === "verifying";
  const sending = flow.email.status === "sending";
  async function confirm(value = code) {
    await flow.verifyEmailCode(value);
    setCode("");
  }
  return (
    <View className="gap-3.5 rounded-xl border border-ink-200 bg-card p-4">
      <CustomText className="text-[13px] leading-5 text-ink-700">
        Enter the 6-digit code we emailed to {stripEmailAlias(flow.answers.email)}.
      </CustomText>
      <View ref={section} collapsable={false} className="gap-3.5">
        <CustomFormField
          id="setup-email-code"
          label="Email verification code"
          error={flow.email.error}
        >
          {(control) => (
            <CustomOTPInput
              {...control}
              value={code}
              onValueChange={(value) => {
                setCode(value);
                flow.clearEmailError();
              }}
              channel="email"
              autoFocus
              onFocus={() => reveal(section)}
              disabled={verifying || sending}
              invalid={!!flow.email.error}
              onComplete={(value) => void confirm(value)}
            />
          )}
        </CustomFormField>
        <CustomButton
          size="xl"
          fullWidth
          loading={verifying}
          loadingText="Verifying…"
          disabled={code.length !== 6 || sending}
          onPress={() => void confirm()}
        >
          Confirm email
        </CustomButton>
      </View>
      <CustomButton
        variant="link"
        size="sm"
        fullWidth
        disabled={verifying || sending || seconds > 0}
        loading={sending}
        onPress={() => {
          Keyboard.dismiss();
          void flow.requestEmailCode();
        }}
      >
        {seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}
      </CustomButton>
    </View>
  );
}
