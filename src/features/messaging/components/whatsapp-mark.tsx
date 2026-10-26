import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

export function WhatsAppMark({ size = 24 }: { size?: number }) {
  const { colors } = useRokloTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.7Z" stroke={colors.primary} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="m8 7.3 1.4-.1 1 2.5-.9 1a8.1 8.1 0 0 0 3.4 3.1l.9-1 2.4 1.1-.1 1.4c-.2.8-1.3 1.3-2.1 1.1-3.5-.8-6.6-3.9-7.1-7.1-.1-.8.4-1.8 1.1-2Z" fill={colors.primary} />
    </Svg>
  </View>;
}
