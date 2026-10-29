import { View } from "react-native";
import { CustomOptionCard } from "@/components/shadcn-custom/customoptioncard";
import { REFERRAL_SOURCES } from "../../constants";
import type { useOnboarding } from "../../hooks/use-onboarding";
import { StepHeader } from "../step-header";

export function SourceStep({ flow }: { flow: ReturnType<typeof useOnboarding> }) {
  return (
    <View className="gap-7">
      <StepHeader
        eyebrow="One last thing"
        title="How did you hear about Roklo?"
        description="Helps us know where to show up."
      />
      <View
        className="gap-2.5"
        accessibilityRole="radiogroup"
        accessibilityLabel="How you heard about Roklo"
      >
        {REFERRAL_SOURCES.map((option) => (
          <CustomOptionCard
            key={option.value}
            label={option.label}
            selected={flow.answers.source === option.value}
            onPress={() =>
              flow.updateAnswers({
                source: flow.answers.source === option.value ? "" : option.value,
              })
            }
          />
        ))}
      </View>
    </View>
  );
}
