import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import {
  FileText,
  ImageOff,
  Maximize2,
  Mic,
  Pause,
  Play,
  Video,
  VideoOff,
} from "lucide-react-native";
import { memo, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { cn } from "@/lib/utils";
import { claimPlayback, releasePlayback } from "../utils/playback";
import { useMediaViewer } from "./media-viewer";
import {
  attachmentExtension,
  attachmentKind,
  attachmentName,
  isWebUrl,
  setGallery,
  type GalleryItem,
} from "../utils/attachments";

/** WhatsApp's media width in a bubble, and the height range a photo's own shape is kept within. */
const MEDIA_WIDTH = 244;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 320;
/** From this many photos and videos, WhatsApp shows a 2x2 album with "+N" on the last tile. */
const ALBUM_FROM = 4;

/** Everything a message carries, laid out as WhatsApp does: photos and videos first, then audio, then documents. */
export const MessageMedia = memo(function MessageMedia({
  messageId,
  files,
  names,
  voice,
  outgoing,
  overlay,
  onLongPress,
}: {
  messageId: string;
  files: string[];
  names: string[];
  /** Long press on any part picks the whole message, as a long press on the bubble does. */
  onLongPress?: () => void;
  /** A WhatsApp voice note: the audio player gets the mic look. */
  voice?: boolean;
  outgoing: boolean;
  /** Drawn over the last photo (the time, when there's no caption). */
  overlay?: React.ReactNode;
}) {
  const items = files.map((url, index) => ({
    url,
    name: attachmentName(url, names[index]),
    kind: attachmentKind(url, names[index]),
  }));
  const visual = items.filter(
    (item): item is GalleryItem => item.kind === "image" || item.kind === "video",
  );
  const audio = items.filter((item) => item.kind === "audio");
  const documents = items.filter((item) => item.kind === "file");
  const viewer = useMediaViewer();
  /** In a chat, the photo opens over it, growing out of where it is (as on WhatsApp); elsewhere, on its own screen. */
  function open(index: number, from?: View | null) {
    if (!viewer) {
      setGallery(messageId, visual);
      router.push({ pathname: "/media", params: { id: messageId, index: String(index) } });
      return;
    }
    if (!from) {
      viewer({ items: visual, index, origin: null });
      return;
    }
    from.measureInWindow((x, y, width, height) =>
      viewer({ items: visual, index, origin: width > 0 ? { x, y, width, height } : null }),
    );
  }
  return (
    <View className="gap-1">
      {visual.length >= ALBUM_FROM ? (
        <View
          className="flex-row flex-wrap gap-0.5 overflow-hidden rounded-xl"
          style={{ width: MEDIA_WIDTH }}
        >
          {visual.slice(0, 4).map((item, index) => (
            <MediaTile
              key={`${item.url}:${index}`}
              item={item}
              square
              more={index === 3 ? visual.length - 4 : 0}
              onPress={(from) => open(index, from)}
              onLongPress={onLongPress}
              overlay={index === 3 ? overlay : undefined}
            />
          ))}
        </View>
      ) : (
        visual.map((item, index) =>
          item.kind === "video" ? (
            // A lone video plays right in the bubble, as on the web app; the corner button opens it full screen.
            <InlineVideo
              key={`${item.url}:${index}`}
              url={item.url}
              onExpand={(from) => open(index, from)}
              onLongPress={onLongPress}
              overlay={index === visual.length - 1 ? overlay : undefined}
            />
          ) : (
            <MediaTile
              key={`${item.url}:${index}`}
              item={item}
              onPress={(from) => open(index, from)}
              onLongPress={onLongPress}
              overlay={index === visual.length - 1 ? overlay : undefined}
            />
          ),
        )
      )}
      {audio.map((item, index) => (
        <AudioAttachment
          key={`${item.url}:${index}`}
          url={item.url}
          voice={voice}
          outgoing={outgoing}
        />
      ))}
      {documents.map((item, index) => (
        <DocumentAttachment
          key={`${item.url}:${index}`}
          url={item.url}
          name={item.name}
          outgoing={outgoing}
          onLongPress={onLongPress}
        />
      ))}
    </View>
  );
});

function MediaTile({
  item,
  square,
  more = 0,
  overlay,
  onPress,
  onLongPress,
}: {
  item: GalleryItem;
  square?: boolean;
  more?: number;
  overlay?: React.ReactNode;
  /** Gets the tile, for the viewer to grow out of it. */
  onPress: (from: View | null) => void;
  onLongPress?: () => void;
}) {
  const tile = useRef<View>(null);
  const [ratio, setRatio] = useState(1);
  const [broken, setBroken] = useState(false);
  const side = (MEDIA_WIDTH - 2) / 2;
  const size = square
    ? { width: side, height: side }
    : {
        width: MEDIA_WIDTH,
        height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, MEDIA_WIDTH / ratio)),
      };
  return (
    <Pressable
      role="button"
      accessibilityLabel={`Open ${item.kind === "video" ? "video" : "photo"}${more ? `, ${more} more` : ""}`}
      ref={tile}
      onPress={() => onPress(tile.current)}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={broken}
      style={size}
      className={cn("overflow-hidden bg-ink-200", !square && "rounded-xl")}
    >
      {broken ? (
        <View className="flex-1 items-center justify-center gap-1.5">
          <CustomIcon as={ImageOff} size={22} className="text-ink-500" />
          <CustomText className="text-xs text-ink-600">
            Couldn&apos;t load this {item.kind === "video" ? "video" : "photo"}
          </CustomText>
        </View>
      ) : item.kind === "image" ? (
        <Image
          source={{ uri: item.url }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          recyclingKey={item.url}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          onLoad={({ source }) => {
            if (source.width && source.height) setRatio(source.width / source.height);
          }}
          onError={() => setBroken(true)}
        />
      ) : (
        <VideoFrame url={item.url} />
      )}
      {item.kind === "video" && !broken && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-black/55">
            <CustomIcon as={Play} size={22} className="ml-0.5 text-white" fill="white" />
          </View>
        </View>
      )}
      {more > 0 && (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center bg-black/50"
        >
          <CustomText className="font-sans-semibold text-2xl text-white">+{more}</CustomText>
        </View>
      )}
      {overlay && (
        <View pointerEvents="none" className="absolute bottom-1.5 right-1.5">
          {overlay}
        </View>
      )}
    </Pressable>
  );
}

/**
 * The video's first frame, as WhatsApp's thumbnail: a muted player that never starts. A texture view,
 * because Android's default surface draws out of bounds inside a scrolling list; the wrapper keeps the
 * native view from swallowing the tap that opens the viewer.
 */
function VideoFrame({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.muted = true;
  });
  return (
    <View pointerEvents="none" className="flex-1 bg-black">
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        surfaceType="textureView"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

/**
 * A video in the bubble: its first frame with a play button and the length, like WhatsApp. Play starts it
 * in place with the platform's controls (the web app's `<video controls>`); the corner button opens the
 * full-screen viewer. Starting it pauses any other audio or video.
 */
function InlineVideo({
  url,
  overlay,
  onExpand,
  onLongPress,
}: {
  url: string;
  overlay?: React.ReactNode;
  onExpand: (from: View | null) => void;
  onLongPress?: () => void;
}) {
  const frame = useRef<View>(null);
  const player = useVideoPlayer(url);
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const [started, setStarted] = useState(false);
  const playbackId = `inline:${url}`;
  useEffect(() => {
    if (isPlaying) claimPlayback(playbackId, () => player.pause());
    else releasePlayback(playbackId);
  }, [isPlaying, player, playbackId]);
  useEffect(() => () => releasePlayback(playbackId), [playbackId]);
  function start() {
    setStarted(true);
    player.play();
  }
  function expand() {
    player.pause();
    onExpand(frame.current);
  }
  const failed = status === "error";
  return (
    <View
      ref={frame}
      collapsable={false}
      style={{ width: MEDIA_WIDTH, height: 190 }}
      className="overflow-hidden rounded-xl bg-black"
    >
      {failed ? (
        <View className="flex-1 items-center justify-center gap-2 px-4">
          <CustomIcon as={VideoOff} size={22} className="text-white/80" />
          <CustomText className="text-center text-xs text-white/80">
            This video can&apos;t play here
          </CustomText>
          {isWebUrl(url) && (
            <MotionPressable
              role="button"
              accessibilityLabel="Open video in browser"
              onPress={() => void Linking.openURL(url).catch(() => undefined)}
              className="min-h-11 justify-center rounded-full bg-white/15 px-4"
            >
              <CustomText className="font-sans-medium text-xs text-white">
                Open in browser
              </CustomText>
            </MotionPressable>
          )}
        </View>
      ) : (
        <>
          {/* A texture view: Android's default surface draws out of bounds inside a scrolling list. */}
          <View pointerEvents={started ? "auto" : "none"} className="flex-1">
            <VideoView
              player={player}
              nativeControls={started}
              contentFit="contain"
              surfaceType="textureView"
              fullscreenOptions={{ enable: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </View>
          {!started && (
            <Pressable
              role="button"
              accessibilityLabel="Play video"
              onPress={start}
              onLongPress={onLongPress}
              delayLongPress={350}
              className="absolute inset-0 items-center justify-center"
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-black/55">
                {status === "loading" ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <CustomIcon as={Play} size={22} className="ml-0.5 text-white" fill="white" />
                )}
              </View>
              {player.duration > 0 && (
                <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5">
                  <CustomIcon as={Video} size={11} className="text-white" />
                  <CustomText className="text-[11px] text-white">
                    {formatSeconds(player.duration)}
                  </CustomText>
                </View>
              )}
              {overlay && (
                <View pointerEvents="none" className="absolute bottom-1.5 right-1.5">
                  {overlay}
                </View>
              )}
            </Pressable>
          )}
          <MotionPressable
            role="button"
            accessibilityLabel="Open video full screen"
            onPress={expand}
            className="absolute right-1 top-1 h-11 w-11 items-center justify-center"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-black/45">
              <CustomIcon as={Maximize2} size={15} className="text-white" />
            </View>
          </MotionPressable>
        </>
      )}
    </View>
  );
}

/** WhatsApp's voice-note speeds, in the order the button steps through them. */
const SPEEDS = [1, 1.5, 2] as const;
let audioModeSet = false;
const formatSeconds = (value: number) => {
  const total = Math.max(0, Math.round(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** WhatsApp's audio row: play/pause, a seekable progress line and the time. Voice notes get a mic badge. */
function AudioAttachment({
  url,
  voice,
  outgoing,
}: {
  url: string;
  voice?: boolean;
  outgoing: boolean;
}) {
  const player = useAudioPlayer(isWebUrl(url) ? url : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [width, setWidth] = useState(1);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  function changeSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    player.setPlaybackRate(next);
  }
  useEffect(() => {
    // Back to the start when it ends, ready to play again.
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);
  // Starting this pauses any other audio or video; pausing or leaving the chat lets go.
  const playbackId = `audio:${url}`;
  useEffect(() => {
    if (status.playing) claimPlayback(playbackId, () => player.pause());
    else releasePlayback(playbackId);
  }, [status.playing, player, playbackId]);
  useEffect(() => () => releasePlayback(playbackId), [playbackId]);
  function toggle() {
    if (!audioModeSet) {
      audioModeSet = true;
      void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    }
    if (status.playing) {
      player.pause();
      return;
    }
    // A new player starts at 1x; keep the speed picked for this message.
    if (player.playbackRate !== speed) player.setPlaybackRate(speed);
    player.play();
  }
  const progress = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <View className="w-[244px] flex-row items-center gap-2.5 py-1 pl-1 pr-2">
      {voice && (
        <View
          className={cn(
            "h-10 w-10 items-center justify-center rounded-full",
            outgoing ? "bg-brand-500" : "bg-ink-400",
          )}
        >
          <CustomIcon as={Mic} size={19} className="text-white" />
        </View>
      )}
      <MotionPressable
        role="button"
        accessibilityLabel={status.playing ? "Pause audio" : "Play audio"}
        disabled={!status.isLoaded}
        onPress={toggle}
        className="h-11 w-9 items-center justify-center"
      >
        <CustomIcon
          as={status.playing ? Pause : Play}
          size={22}
          className={status.isLoaded ? "text-ink-600" : "text-ink-400"}
          fill="currentColor"
        />
      </MotionPressable>
      <View className="flex-1 gap-1.5">
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Audio position"
          className="h-5 justify-center"
          onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width || 1)}
          onPress={({ nativeEvent }) => {
            if (status.duration)
              void player.seekTo((nativeEvent.locationX / width) * status.duration);
          }}
        >
          <View className="h-1 rounded-full bg-ink-250">
            <View
              className={cn("h-1 rounded-full", outgoing ? "bg-brand-600" : "bg-tick-read")}
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          <View
            pointerEvents="none"
            className={cn(
              "absolute h-3 w-3 rounded-full",
              outgoing ? "bg-brand-600" : "bg-tick-read",
            )}
            style={{ left: Math.max(0, progress * width - 6) }}
          />
        </Pressable>
        <CustomText className="text-[11px] text-bubble-meta">
          {status.playing || status.currentTime > 0
            ? formatSeconds(status.currentTime)
            : status.duration
              ? formatSeconds(status.duration)
              : voice
                ? "Voice message"
                : "Audio"}
        </CustomText>
      </View>
      {/* WhatsApp's speed pill: 1x → 1.5x → 2x. */}
      {status.isLoaded && (
        <MotionPressable
          role="button"
          accessibilityLabel={`Playback speed ${speed}x. Change speed`}
          onPress={changeSpeed}
          className="h-11 items-center justify-center"
        >
          <View
            className={cn(
              "min-w-9 items-center rounded-full px-1.5 py-0.5",
              speed === 1 ? "bg-ink-150" : "bg-brand-100",
            )}
          >
            <CustomText
              className={cn(
                "font-sans-semibold text-[11px]",
                speed === 1 ? "text-ink-600" : "text-primary",
              )}
            >
              {speed}x
            </CustomText>
          </View>
        </MotionPressable>
      )}
    </View>
  );
}

/** A document as WhatsApp shows it: type tile, name, "PDF · Tap to open". Opens in the phone's viewer or browser. */
function DocumentAttachment({
  url,
  name,
  outgoing,
  onLongPress,
}: {
  url: string;
  name: string;
  outgoing: boolean;
  onLongPress?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const ext = attachmentExtension(name);
  async function open() {
    if (!isWebUrl(url)) {
      setError("This attachment can't be opened.");
      return;
    }
    try {
      setError(null);
      await Linking.openURL(url);
    } catch {
      setError("Couldn't open the attachment. Try again.");
    }
  }
  return (
    <View className="gap-1">
      <MotionPressable
        role="button"
        accessibilityLabel={`Open ${name}`}
        onPress={() => void open()}
        onLongPress={onLongPress}
        delayLongPress={350}
        className={cn(
          "min-h-14 w-[244px] flex-row items-center gap-3 rounded-xl px-3 py-2.5",
          outgoing ? "bg-brand-100" : "bg-ink-50",
        )}
      >
        <View
          className={cn(
            "h-10 w-9 items-center justify-center rounded-md",
            ext === "PDF" ? "bg-error-fg" : "bg-info-fg",
          )}
        >
          {ext ? (
            <CustomText className="font-sans-bold text-[9px] text-white">{ext}</CustomText>
          ) : (
            <CustomIcon as={FileText} size={18} className="text-white" />
          )}
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <CustomText numberOfLines={2} className="font-sans-medium text-sm text-foreground">
            {name}
          </CustomText>
          <CustomText className="text-[11px] text-muted-foreground">
            {ext ? `${ext} · ` : ""}Tap to open
          </CustomText>
        </View>
      </MotionPressable>
      {error && (
        <CustomText role="alert" className="text-xs text-error-fg">
          {error}
        </CustomText>
      )}
    </View>
  );
}
