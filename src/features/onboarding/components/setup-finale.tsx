import { Image } from "expo-image";
import { ArrowRight, Check, CircleCheck, Inbox } from "lucide-react-native";
import { View } from "react-native";

import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import type { SetupAnswers } from "../types/onboarding.types";
import { SetupLayout } from "./setup-layout";
import { StepHeader } from "./step-header";

export function SetupSubmitting({ includeWorkspace }: { includeWorkspace: boolean }) {
  return (
    <SetupLayout>
      <View className="flex-1 justify-center gap-8 py-10">
        <View className="self-start rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <CustomSpinner size="large" accessibilityLabel="Saving your setup" />
        </View>
        <StepHeader
          eyebrow="Almost there"
          title={includeWorkspace ? "Making room for your team" : "Getting things ready"}
          description="We're saving your details and getting your workspace ready. This will only take a moment."
        />
        <View className="gap-3 rounded-xl border border-ink-200 bg-card p-5">
          {["Phone number verified", "Your preferences are ready"].map((label) => (
            <View key={label} className="flex-row items-center gap-2.5">
              <CustomIcon as={Check} size={17} className="text-brand-700" />
              <CustomText className="text-sm text-ink-700">{label}</CustomText>
            </View>
          ))}
        </View>
      </View>
    </SetupLayout>
  );
}

export function SetupComplete({
  answers,
  includeWorkspace,
  preview,
  onOpenInbox,
}: {
  answers: SetupAnswers;
  includeWorkspace: boolean;
  preview: string | null;
  onOpenInbox: () => void;
}) {
  const name = answers.name.trim().split(/\s+/)[0];
  return (
    <SetupLayout
      footer={
        <View className="gap-3">
          <CustomButton
            fullWidth
            size="xl"
            onPress={onOpenInbox}
            trailingIcon={
              <CustomIcon as={ArrowRight} size={18} className="text-primary-foreground" />
            }
          >
            Go to inbox
          </CustomButton>
          <CustomText className="text-center text-xs leading-5 text-ink-600">
            You can update your details anytime in Settings.
          </CustomText>
        </View>
      }
    >
      <View className="grow justify-center gap-7 py-7">
        <View className="h-20 w-20 items-center justify-center self-center rounded-full border border-brand-200 bg-brand-100">
          <CustomIcon as={CircleCheck} size={42} strokeWidth={1.5} className="text-brand-700" />
        </View>
        <View className="gap-3">
          <CustomText
            role="heading"
            className="text-center font-display text-[38px] leading-[44px] tracking-[-0.7px]"
          >
            You’re all set{name ? `, ${name}` : ""}
          </CustomText>
          <CustomText className="text-center text-[15px] leading-6 text-ink-700">
            {includeWorkspace
              ? `${answers.workspaceName.trim()} is ready.`
              : "Your profile is ready."}{" "}
            Welcome to Roklo.
          </CustomText>
        </View>
        <View className="flex-row items-center gap-3 rounded-xl border border-ink-200 bg-card p-4">
          {preview ? (
            <Image
              source={{ uri: preview }}
              style={{ width: 44, height: 44, borderRadius: 10 }}
              contentFit="cover"
              accessibilityLabel="Workspace logo"
            />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
              <CustomIcon as={Inbox} size={23} className="text-brand-700" />
            </View>
          )}
          <View className="flex-1 gap-1">
            <CustomText className="font-sans-semibold text-sm">
              {includeWorkspace ? answers.workspaceName.trim() : "Your workspace"}
            </CustomText>
            <CustomText className="text-xs text-ink-600">
              {includeWorkspace ? "Workspace created · Owner" : "Profile complete · Member"}
            </CustomText>
          </View>
          <CustomIcon as={Check} size={18} className="text-brand-700" />
        </View>
      </View>
    </SetupLayout>
  );
}
