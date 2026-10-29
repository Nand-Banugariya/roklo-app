import { Redirect } from "expo-router";
import { View } from "react-native";

import { CustomBackButton } from "@/components/shadcn-custom/custombackbutton";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomCaptcha } from "@/components/shadcn-custom/customcaptcha";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { getCountry } from "@/lib/auth/countries";
import { formatPhone } from "@/lib/auth/phone";

import { AuthHeader } from "../components/auth-header";
import { AuthLayout } from "../components/auth-layout";
import { useCountdown } from "../hooks/use-countdown";
import { useSignIn } from "../providers/sign-in-provider";

export default function EmailScreen() {
  const form = useSignIn();
  const seconds = useCountdown(form.sendBlockedUntil);
  if (!form.phone || !form.emailRequired) return <Redirect href="/login" />;
  return (
    <AuthLayout>
      <View className="gap-7">
        <CustomBackButton disabled={!!form.busy} onPress={form.backToPhone}>
          Use a different number
        </CustomBackButton>
        <AuthHeader title="Add your email">
          For numbers outside India we check your email first, then text a code to{" "}
          <CustomText className="font-sans-semibold text-[15px] text-ink-900">
            {getCountry(form.countryCode).dial} {formatPhone(form.phone, form.countryCode)}
          </CustomText>
          .
        </AuthHeader>
        <CustomFormField
          id="email"
          required
          size="lg"
          label="Email"
          help="We’ll email you a 6-digit code."
          error={form.emailError}
        >
          {(control) => (
            <CustomInput
              {...control}
              size="xl"
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              value={form.email}
              onChangeText={form.changeEmail}
              placeholder="you@business.com"
              invalid={!!form.emailError}
              editable={!form.busy}
              returnKeyType="go"
              onSubmitEditing={() => void form.requestCode(true)}
            />
          )}
        </CustomFormField>
        <CustomCaptcha resetKey={form.captchaKey} onToken={form.setCaptchaToken} />
        <CustomButton
          size="xl"
          fullWidth
          loading={form.busy === "send"}
          loadingText="Sending code"
          disabled={seconds > 0}
          onPress={() => void form.requestCode(true)}
        >
          {seconds > 0 ? `Try again in ${seconds}s` : "Send code"}
        </CustomButton>
      </View>
    </AuthLayout>
  );
}
