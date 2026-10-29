import { Moon, Sun } from "lucide-react-native";
import { View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

export function AppearanceControls() {
  const { mode, setColorScheme } = useRokloTheme();
  return (
    <View className="flex-row gap-3">
      <CustomButton
        size="xl"
        variant={mode === "light" ? "soft" : "secondary"}
        className="flex-1"
        accessibilityState={{ selected: mode === "light" }}
        aria-pressed={mode === "light"}
        onPress={() => setColorScheme("light")}
        leadingIcon={<CustomIcon as={Sun} size={18} className="text-ink-700" />}
      >
        Light
      </CustomButton>
      <CustomButton
        size="xl"
        variant={mode === "dark" ? "soft" : "secondary"}
        className="flex-1"
        accessibilityState={{ selected: mode === "dark" }}
        aria-pressed={mode === "dark"}
        onPress={() => setColorScheme("dark")}
        leadingIcon={<CustomIcon as={Moon} size={18} className="text-ink-700" />}
      >
        Dark
      </CustomButton>
    </View>
  );
}
