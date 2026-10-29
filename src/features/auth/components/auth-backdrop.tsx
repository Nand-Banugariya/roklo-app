import { Platform } from "react-native";
import Svg, { Circle, Defs, Mask, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

import { useRokloTheme } from "@/hooks/use-roklo-theme";

export function AuthBackdrop() {
  const { colors } = useRokloTheme();
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: "absolute" }}
      pointerEvents="none"
      {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })}
    >
      <Defs>
        <RadialGradient id="auth-glow" cx="0" cy="0" r="85%">
          <Stop offset="0" stopColor={colors["brand-200"]} stopOpacity={0.35} />
          <Stop offset="1" stopColor={colors["brand-200"]} stopOpacity={0} />
        </RadialGradient>
        <Pattern id="auth-dots" width={22} height={22} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={1} fill={colors["ink-900"]} opacity={0.07} />
        </Pattern>
        <RadialGradient id="auth-fade" cx="0" cy="0" r="80%">
          <Stop offset="0" stopColor="white" />
          <Stop offset="1" stopColor="black" />
        </RadialGradient>
        <Mask id="auth-dot-mask">
          <Rect width="100%" height="100%" fill="url(#auth-fade)" />
        </Mask>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#auth-glow)" />
      <Rect width="100%" height="100%" fill="url(#auth-dots)" mask="url(#auth-dot-mask)" />
    </Svg>
  );
}
