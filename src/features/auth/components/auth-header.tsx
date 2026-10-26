import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { CustomText } from "@/components/shadcn-custom/customtext";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

export function AuthHeader({
  title,
  accent = false,
  children,
}: {
  title: string;
  accent?: boolean;
  children: ReactNode;
}) {
  const { colors } = useRokloTheme();
  const words = title.split(" ");
  const last = accent && words.length > 1 ? words.pop() : null;
  return (
    <View className="gap-2.5">
      {last ? (
        <View
          className="flex-row flex-wrap items-baseline gap-2"
          accessible
          accessibilityRole="header"
          accessibilityLabel={title}
        >
          <CustomText className="font-display text-[40px] leading-[44px] tracking-[-0.8px]">
            {words.join(" ")}
          </CustomText>
          <View>
            <CustomText className="font-display-italic text-[40px] leading-[44px] tracking-[-0.8px] text-brand-700">
              {last}
            </CustomText>
            <Svg
              width="112%"
              height={12}
              viewBox="0 0 120 14"
              preserveAspectRatio="none"
              style={{ position: "absolute", left: "-6%", bottom: -6 }}
              {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })}
            >
              <Path
                d="M3 9 C30 3 62 3 90 6 S112 10 117 5"
                fill="none"
                stroke={colors["brand-400"]}
                strokeWidth={3.5}
                strokeLinecap="round"
              />
            </Svg>
          </View>
        </View>
      ) : (
        <CustomText
          accessibilityRole="header"
          className="font-display text-[40px] leading-[44px] tracking-[-0.8px]"
        >
          {title}
        </CustomText>
      )}
      <CustomText className="text-[15px] leading-[23px] text-ink-700">
        {children}
      </CustomText>
    </View>
  );
}
