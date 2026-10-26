import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

/** The web app's doodle tile (60% alpha baked in), a 2x file shown at half size so it stays sharp. */
const TILE = { width: 513.5, height: 412 };
const SOURCES = {
  light: require("@/assets/images/chat-wallpaper.webp"),
  dark: require("@/assets/images/chat-wallpaper-dark.webp"),
};

/**
 * The WhatsApp-style chat wallpaper over `bg-chat-bg`, fixed behind the thread as on WhatsApp mobile.
 * Tiles are laid out by hand: `resizeMode="repeat"` tiles at different scales on iOS, Android and web.
 */
export function ChatWallpaper() {
  const { mode } = useRokloTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const columns = Math.ceil(size.width / TILE.width);
  const rows = Math.ceil(size.height / TILE.height);
  return <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill} className="overflow-hidden bg-chat-bg"
    onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}>
    {Array.from({ length: rows * columns }, (_, index) => <Image key={index} source={SOURCES[mode]} contentFit="fill"
      cachePolicy="memory-disk" transition={0}
      style={{ position: "absolute", left: (index % columns) * TILE.width, top: Math.floor(index / columns) * TILE.height, ...TILE }} />)}
  </View>;
}
