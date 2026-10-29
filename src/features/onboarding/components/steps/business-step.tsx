import { View } from "react-native";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomOptionCard } from "@/components/shadcn-custom/customoptioncard";
import { CustomSelect } from "@/components/shadcn-custom/customselect";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { INDUSTRIES, TEAM_SIZES } from "../../constants";
import type { useOnboarding } from "../../hooks/use-onboarding";
import { StepHeader } from "../step-header";

export function BusinessStep({ flow }: { flow: ReturnType<typeof useOnboarding> }) {
  return (
    <View className="gap-7">
      <StepHeader
        title="About your business"
        description="We'll suggest templates and defaults that fit how you work."
      />
      <CustomFormField id="industry" label="Industry" size="lg">
        {(control) => (
          <CustomSelect
            {...control}
            options={INDUSTRIES}
            value={flow.answers.industry}
            onValueChange={(industry) => flow.updateAnswers({ industry })}
            placeholder="Choose your industry"
          />
        )}
      </CustomFormField>
      <View className="gap-3" accessibilityRole="radiogroup" accessibilityLabel="Team size">
        <CustomText className="font-sans-semibold text-[13px]">How big is your team?</CustomText>
        {TEAM_SIZES.map((option) => (
          <CustomOptionCard
            key={option.value}
            label={option.label}
            selected={flow.answers.teamSize === option.value}
            onPress={() =>
              flow.updateAnswers({
                teamSize: flow.answers.teamSize === option.value ? "" : option.value,
              })
            }
          />
        ))}
      </View>
    </View>
  );
}
