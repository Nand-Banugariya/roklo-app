import { Bell, Inbox, Megaphone, Users, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { CustomOptionCard } from "@/components/shadcn-custom/customoptioncard";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MESSAGE_VOLUMES, USE_CASES, type UseCaseId } from "../../constants";
import type { useOnboarding } from "../../hooks/use-onboarding";
import { StepHeader } from "../step-header";

const icons: Record<UseCaseId, LucideIcon> = {
  inbox: Inbox,
  broadcast: Megaphone,
  reminders: Bell,
  team: Users,
};
export function UsageStep({ flow }: { flow: ReturnType<typeof useOnboarding> }) {
  return (
    <View className="gap-7">
      <StepHeader
        title="How will you use Roklo?"
        description="Pick all that apply. Help us understand what matters to your team."
      />
      <View className="gap-2.5" accessibilityLabel="Uses">
        {USE_CASES.map((option) => (
          <CustomOptionCard
            key={option.value}
            label={option.title}
            description={option.description}
            icon={icons[option.value]}
            multiple
            selected={flow.answers.useCases.includes(option.value)}
            onPress={() => flow.toggleUseCase(option.value)}
          />
        ))}
      </View>
      <View
        className="gap-3"
        accessibilityRole="radiogroup"
        accessibilityLabel="Monthly message volume"
      >
        <CustomText className="font-sans-semibold text-[13px]">
          Messages you send in a month
        </CustomText>
        {MESSAGE_VOLUMES.map((option) => (
          <CustomOptionCard
            key={option.value}
            label={option.label}
            selected={flow.answers.volume === option.value}
            onPress={() =>
              flow.updateAnswers({
                volume: flow.answers.volume === option.value ? "" : option.value,
              })
            }
          />
        ))}
      </View>
    </View>
  );
}
