import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { CustomText } from "./customtext";

const TONES = [
  { box: "border-brand-200 bg-brand-50", text: "text-brand-800" },
  { box: "border-info-tint-hover bg-info-tint", text: "text-info-fg" },
  { box: "border-purple-tint-hover bg-purple-tint", text: "text-purple-fg" },
  { box: "border-orange-tint bg-orange-tint", text: "text-orange-fg" },
  { box: "border-warning-tint bg-warning-tint", text: "text-amber-fg" },
];
/** Stable tone per name, so a contact keeps the same color everywhere. */
function toneFor(name?: string | null) {
  let hash = 0;
  for (const char of name ?? "") hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export function CustomAvatar({
  name,
  src,
  size = 40,
  square,
  colorful,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  square?: boolean;
  colorful?: boolean;
}) {
  return (
    <AvatarContent
      key={src ?? name}
      name={name}
      src={src}
      size={size}
      square={square}
      colorful={colorful}
    />
  );
}
function AvatarContent({
  name,
  src,
  size,
  square,
  colorful,
}: {
  name?: string | null;
  src?: string | null;
  size: number;
  square?: boolean;
  colorful?: boolean;
}) {
  const tone = colorful ? toneFor(name) : TONES[0];
  const [failed, setFailed] = useState(false);
  const radius = square ? 12 : size / 2;
  const initials = (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "R"
  ).toUpperCase();
  return (
    <View
      className={cn("items-center justify-center overflow-hidden border", tone.box)}
      style={{ width: size, height: size, borderRadius: radius }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {src && !failed ? (
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <CustomText
          className={cn("font-sans-semibold", tone.text)}
          style={{ fontSize: size * 0.34 }}
        >
          {initials}
        </CustomText>
      )}
    </View>
  );
}
