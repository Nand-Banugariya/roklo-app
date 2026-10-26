import { ChevronDown } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { selectActiveWorkspace } from "@/features/workspaces/store/workspace-selectors";
import { useAppSelector } from "@/store/hooks";

export function WorkspaceTrigger({ onPress }: { onPress: () => void }) {
  const workspace = useAppSelector(selectActiveWorkspace);
  const status = useAppSelector((state) => state.workspace.status);
  return (
    <Pressable
      role="button"
      accessibilityLabel="Switch workspace"
      accessibilityHint={workspace?.name ?? "Choose your workspace"}
      onPress={onPress}
      className="min-h-12 min-w-0 flex-1 flex-row items-center gap-2.5 rounded-xl px-2 py-1 active:bg-ink-75"
    >
      <CustomAvatar
        name={workspace?.name ?? "Roklo"}
        src={workspace?.logo}
        square
        size={36}
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <CustomText numberOfLines={1} className="text-[10px] text-ink-600 dark:text-white">WORKSPACE</CustomText>
        <CustomText
          numberOfLines={1}
          className="font-sans-semibold text-[13px] dark:text-white"
        >
          {workspace?.name ??
            (status === "loading" ? "Loading workspaces…" : "Choose workspace")}
        </CustomText>
      </View>
      <CustomIcon as={ChevronDown} size={16} className="text-ink-500" />
    </Pressable>
  );
}
