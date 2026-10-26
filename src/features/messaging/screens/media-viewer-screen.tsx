import { useEvent } from "expo";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowLeft, ExternalLink, VideoOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, View, useWindowDimensions } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { goBack } from "@/features/navigation/components/screen-header";
import { InboxState } from "../components/inbox-state";
import { getGallery, isWebUrl, type GalleryItem } from "../utils/attachments";
import { claimPlayback, releasePlayback } from "../utils/playback";

/** A message's photos and videos, full screen on black, swiped through like WhatsApp's viewer. */
export function MediaViewerScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const items = getGallery(id);
  const { width } = useWindowDimensions();
  const start = Math.min(Math.max(Number(index) || 0, 0), Math.max((items?.length ?? 1) - 1, 0));
  const [current, setCurrent] = useState(start);
  const item = items?.[current];
  return <View className="flex-1 bg-black">
    <View className="min-h-16 flex-row items-center gap-2 px-2 py-2">
      <MotionPressable role="button" accessibilityLabel="Go back" onPress={goBack} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
        <CustomIcon as={ArrowLeft} size={23} className="text-white" />
      </MotionPressable>
      <View className="min-w-0 flex-1">
        <CustomText numberOfLines={1} className="font-sans-semibold text-base text-white">{item?.name ?? "Media"}</CustomText>
        {items && items.length > 1 && <CustomText className="text-xs text-white/70">{current + 1} of {items.length}</CustomText>}
      </View>
      {item && isWebUrl(item.url) && <MotionPressable role="button" accessibilityLabel="Open in browser" onPress={() => void Linking.openURL(item.url).catch(() => undefined)}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
        <CustomIcon as={ExternalLink} size={21} className="text-white" />
      </MotionPressable>}
    </View>
    {!items?.length ? <View className="flex-1 bg-card"><InboxState title="This media isn't available" description="Go back to the chat and open it again." action="Back to chat" onAction={goBack} /></View>
      : <FlatList data={items} horizontal pagingEnabled showsHorizontalScrollIndicator={false} initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })} keyExtractor={(media, i) => `${media.url}:${i}`}
        onMomentumScrollEnd={({ nativeEvent }) => setCurrent(Math.round(nativeEvent.contentOffset.x / width))}
        renderItem={({ item: media, index: i }) => <View style={{ width }} className="flex-1 justify-center">
          {media.kind === "image" ? <Image source={{ uri: media.url }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={150} accessibilityLabel={media.name} />
            : <ViewerVideo item={media} active={i === current} />}
        </View>} />}
  </View>;
}

/** Plays while it's the page on screen, with the platform's own controls; says so when the video can't play. */
function ViewerVideo({ item, active }: { item: GalleryItem; active: boolean }) {
  const player = useVideoPlayer(item.url);
  const { status, error } = useEvent(player, "statusChange", { status: player.status });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  useEffect(() => {
    if (active) player.play(); else player.pause();
  }, [active, player]);
  // Playing (on open or from its own controls) pauses any audio message; an audio message started later pauses this.
  const playbackId = `video:${item.url}`;
  useEffect(() => {
    if (isPlaying) claimPlayback(playbackId, () => player.pause());
    else releasePlayback(playbackId);
  }, [isPlaying, player, playbackId]);
  useEffect(() => () => releasePlayback(playbackId), [playbackId]);
  if (status === "error") return <View className="flex-1 items-center justify-center gap-3 px-8">
    <CustomIcon as={VideoOff} size={30} className="text-white/80" />
    <CustomText className="text-center font-sans-semibold text-base text-white">This video can&apos;t play here</CustomText>
    {!!error?.message && <CustomText className="text-center text-xs text-white/60">{error.message}</CustomText>}
    {isWebUrl(item.url) && <CustomButton variant="secondary" onPress={() => void Linking.openURL(item.url).catch(() => undefined)}>Open in browser</CustomButton>}
  </View>;
  return <View className="flex-1">
    <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} style={{ width: "100%", height: "100%" }} />
    {status === "loading" && <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <ActivityIndicator color="#ffffff" accessibilityLabel="Loading video" />
    </View>}
  </View>;
}
