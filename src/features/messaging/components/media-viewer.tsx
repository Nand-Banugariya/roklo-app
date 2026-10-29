import { useEvent } from "expo";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowLeft, ExternalLink, VideoOff } from "lucide-react-native";
import { createContext, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { isWebUrl, type GalleryItem } from "../utils/attachments";
import { claimPlayback, releasePlayback } from "../utils/playback";

/** Where a photo was on screen when tapped (window coordinates): the viewer grows out of it and back into it. */
export interface MediaOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** What a bubble opens: its photos and videos, the one tapped, and where it was. */
export interface MediaViewerRequest {
  items: GalleryItem[];
  index: number;
  origin: MediaOrigin | null;
}

/**
 * Opens a message's photos over the chat, as WhatsApp does (no other screen). Null outside a chat: the bubble
 * falls back to the full-screen viewer route there.
 */
export const MediaViewerContext = createContext<((request: MediaViewerRequest) => void) | null>(
  null,
);
export const useMediaViewer = () => useContext(MediaViewerContext);

const OPEN_MS = 260;
const CLOSE_MS = 220;
/** Dragged this far (or flung this fast) down, the viewer closes. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * The chat's photo viewer, over the whole chat: grows out of the tapped photo to full screen on black, swipes
 * between the message's photos and videos, and goes back into the photo on Back, Android's back or a swipe
 * down. `host` is where this view sits in the window, to place the tapped photo inside it.
 */
export function MediaViewerOverlay({
  request,
  host,
  onClosed,
}: {
  request: MediaViewerRequest;
  host: MediaOrigin;
  onClosed: () => void;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const [closing, setClosing] = useState(false);
  const [current, setCurrent] = useState(request.index);
  // The tapped photo, in this view's coordinates; the viewer starts there and ends there.
  const from =
    request.origin && host.width > 0
      ? {
          x: request.origin.x - host.x,
          y: request.origin.y - host.y,
          width: request.origin.width,
          height: request.origin.height,
        }
      : null;
  useEffect(() => {
    Keyboard.dismiss();
    progress.set(
      reduced ? 1 : withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, reduced]);
  const close = () => {
    if (closing) return;
    setClosing(true);
    if (reduced) {
      onClosed();
      return;
    }
    progress.set(
      withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onClosed)();
      }),
    );
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => subscription.remove();
  });

  // Down (or up) follows the finger; far or fast enough closes, else it springs back. Sideways swipes are the pager's.
  const pan = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .failOffsetX([-14, 14])
    .onUpdate((event) => {
      drag.set(event.translationY);
    })
    .onEnd((event) => {
      if (
        Math.abs(event.translationY) > DISMISS_DISTANCE ||
        Math.abs(event.velocityY) > DISMISS_VELOCITY
      )
        runOnJS(close)();
      else drag.set(withTiming(0, { duration: 180 }));
    });

  const backdrop = useAnimatedStyle(() => ({
    opacity: progress.get() * interpolate(Math.abs(drag.get()), [0, 400], [1, 0.25], "clamp"),
  }));
  const chrome = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.6, 1], [0, 1], "clamp") * (drag.get() === 0 ? 1 : 0.4),
  }));
  // From the tapped photo's box to the full view: centre moves, size scales.
  const media = useAnimatedStyle(() => {
    const t = progress.get();
    const shrink = interpolate(Math.abs(drag.get()), [0, 400], [1, 0.8], "clamp");
    if (!from)
      return {
        opacity: t,
        transform: [{ translateY: drag.get() }, { scale: (0.92 + 0.08 * t) * shrink }],
      };
    const scale = interpolate(t, [0, 1], [from.width / host.width, 1]);
    const x = interpolate(t, [0, 1], [from.x + from.width / 2 - host.width / 2, 0]);
    const y = interpolate(t, [0, 1], [from.y + from.height / 2 - host.height / 2, 0]);
    return {
      opacity: interpolate(t, [0, 0.15], [0, 1], "clamp"),
      transform: [{ translateX: x }, { translateY: y + drag.get() }, { scale: scale * shrink }],
    };
  });

  return (
    <View
      className="absolute inset-0"
      style={{ zIndex: 50, elevation: 50 }}
      accessibilityViewIsModal
    >
      <Animated.View pointerEvents="none" className="absolute inset-0 bg-black" style={backdrop} />
      <GestureDetector gesture={pan}>
        <Animated.View className="flex-1" style={media}>
          <MediaPager items={request.items} start={request.index} onIndex={setCurrent} />
        </Animated.View>
      </GestureDetector>
      {/* Back, the name and the count over the photo, as WhatsApp's viewer; they fade in once it has grown. */}
      <Animated.View className="absolute left-0 right-0 top-0" style={chrome}>
        <ViewerHeader
          items={request.items}
          start={request.index}
          current={current}
          onBack={close}
        />
      </Animated.View>
    </View>
  );
}

/** A message's photos and videos, full screen on black, swiped through (the viewer route's page). */
export function MediaGallery({
  items,
  start,
  onBack,
}: {
  items: GalleryItem[];
  start: number;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState(start);
  return (
    <View className="flex-1 bg-black">
      <ViewerHeader items={items} start={start} current={current} onBack={onBack} />
      <MediaPager items={items} start={start} onIndex={setCurrent} />
    </View>
  );
}

/** Back, the photo's name, "2 of 4" and Open in browser. */
function ViewerHeader({
  items,
  start,
  current: shown,
  onBack,
}: {
  items: GalleryItem[];
  start: number;
  current?: number;
  onBack: () => void;
}) {
  const current = shown ?? start;
  const item = items[current];
  return (
    <View className="min-h-16 flex-row items-center gap-2 bg-black/40 px-2 py-2">
      <MotionPressable
        role="button"
        accessibilityLabel="Close"
        onPress={onBack}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
      >
        <CustomIcon as={ArrowLeft} size={23} className="text-white" />
      </MotionPressable>
      <View className="min-w-0 flex-1">
        <CustomText numberOfLines={1} className="font-sans-semibold text-base text-white">
          {item?.name ?? "Media"}
        </CustomText>
        {items.length > 1 && (
          <CustomText className="text-xs text-white/70">
            {current + 1} of {items.length}
          </CustomText>
        )}
      </View>
      {item && isWebUrl(item.url) && (
        <MotionPressable
          role="button"
          accessibilityLabel="Open in browser"
          onPress={() => void Linking.openURL(item.url).catch(() => undefined)}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <CustomIcon as={ExternalLink} size={21} className="text-white" />
        </MotionPressable>
      )}
    </View>
  );
}

/** The photos and videos, one a page, starting at `start`. */
function MediaPager({
  items,
  start,
  onIndex,
}: {
  items: GalleryItem[];
  start: number;
  onIndex: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const first = Math.min(Math.max(start, 0), Math.max(items.length - 1, 0));
  const [current, setCurrent] = useState(first);
  return (
    <FlatList
      data={items}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={first}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      keyExtractor={(media, i) => `${media.url}:${i}`}
      onMomentumScrollEnd={({ nativeEvent }) => {
        const next = Math.round(nativeEvent.contentOffset.x / width);
        setCurrent(next);
        onIndex(next);
      }}
      renderItem={({ item: media, index: i }) => (
        <View style={{ width }} className="flex-1 justify-center">
          {media.kind === "image" ? (
            <Image
              source={{ uri: media.url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              cachePolicy="memory-disk"
              accessibilityLabel={media.name}
            />
          ) : (
            <ViewerVideo item={media} active={i === current} />
          )}
        </View>
      )}
    />
  );
}

/** Plays while it's the page on screen, with the platform's own controls; says so when the video can't play. */
function ViewerVideo({ item, active }: { item: GalleryItem; active: boolean }) {
  const player = useVideoPlayer(item.url);
  const { status, error } = useEvent(player, "statusChange", { status: player.status });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  // Playing (on open or from its own controls) pauses any audio message; an audio message started later pauses this.
  const playbackId = `video:${item.url}`;
  useEffect(() => {
    if (isPlaying) claimPlayback(playbackId, () => player.pause());
    else releasePlayback(playbackId);
  }, [isPlaying, player, playbackId]);
  useEffect(() => () => releasePlayback(playbackId), [playbackId]);
  if (status === "error")
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <CustomIcon as={VideoOff} size={30} className="text-white/80" />
        <CustomText className="text-center font-sans-semibold text-base text-white">
          This video can&apos;t play here
        </CustomText>
        {!!error?.message && (
          <CustomText className="text-center text-xs text-white/60">{error.message}</CustomText>
        )}
        {isWebUrl(item.url) && (
          <CustomButton
            variant="secondary"
            onPress={() => void Linking.openURL(item.url).catch(() => undefined)}
          >
            Open in browser
          </CustomButton>
        )}
      </View>
    );
  return (
    <View className="flex-1">
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        style={{ width: "100%", height: "100%" }}
      />
      {status === "loading" && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color="#ffffff" accessibilityLabel="Loading video" />
        </View>
      )}
    </View>
  );
}
