import { Image } from "expo-image";
import { Building2, Upload } from "lucide-react-native";
import { useRef } from "react";
import { View } from "react-native";

import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { WORKSPACE_NAME_MAX } from "../../constants";
import type { useWorkspaceLogo } from "../../hooks/use-workspace-logo";
import { useSetupFocus } from "../setup-layout";
import { StepHeader } from "../step-header";

export function WorkspaceStep({
  name,
  onChange,
  upload,
  onContinue,
}: {
  name: string;
  onChange: (value: string) => void;
  upload: ReturnType<typeof useWorkspaceLogo>;
  onContinue: () => void;
}) {
  const field = useRef<View>(null);
  const reveal = useSetupFocus();
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <View className="gap-7">
      <StepHeader
        eyebrow="You're in"
        title="Name your workspace"
        description="This is where your team, contacts and conversations live. Use your business name."
      />
      <View className="gap-3">
        <View className="flex-row items-center gap-4">
          {upload.preview ? (
            <Image
              source={{ uri: upload.preview }}
              accessibilityLabel="Workspace logo"
              style={{ width: 64, height: 64, borderRadius: 14 }}
              contentFit="cover"
            />
          ) : (
            <View
              className={
                initials
                  ? "h-16 w-16 items-center justify-center rounded-2xl bg-brand-600"
                  : "h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-card"
              }
            >
              {initials ? (
                <CustomText className="font-sans-semibold text-2xl text-primary-foreground">
                  {initials}
                </CustomText>
              ) : (
                <CustomIcon as={Building2} size={26} className="text-ink-500" />
              )}
            </View>
          )}
          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <CustomButton
                variant="secondary"
                size="sm"
                className="min-h-11"
                loading={upload.busy}
                onPress={() => void upload.choose()}
                leadingIcon={<CustomIcon as={Upload} size={15} />}
              >
                {upload.logo ? "Change logo" : "Upload logo"}
              </CustomButton>
              {upload.logo && (
                <CustomButton
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onPress={upload.remove}
                >
                  Remove
                </CustomButton>
              )}
            </View>
            <CustomText className="text-xs leading-5 text-ink-600">
              Optional · PNG or JPG, up to 2 MB.
            </CustomText>
          </View>
        </View>
        {upload.error && (
          <CustomText role="alert" className="text-[13px] text-error-fg">
            {upload.error}
          </CustomText>
        )}
      </View>
      <View ref={field} collapsable={false}>
        <CustomFormField
          id="workspace-name"
          label="Workspace name"
          required
          size="lg"
          help="You can change this later in Settings."
        >
          {(control) => (
            <CustomInput
              {...control}
              size="xl"
              value={name}
              onChangeText={onChange}
              placeholder="e.g. Sharma Insurance"
              maxLength={WORKSPACE_NAME_MAX}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={onContinue}
              onFocus={() => reveal(field)}
            />
          )}
        </CustomFormField>
      </View>
    </View>
  );
}
