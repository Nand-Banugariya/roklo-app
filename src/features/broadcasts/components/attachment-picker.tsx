import * as DocumentPicker from "expo-document-picker";
import {
  FileText,
  ImageIcon,
  Music,
  Paperclip,
  Video,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import type { OutgoingFile } from "@/features/messaging/types";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_MB,
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS,
} from "../constants";
import type { SavedFile } from "../types";

const MAX_BYTES = ATTACHMENT_MAX_MB * 1024 * 1024;
const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

/** A saved file's type, from its extension, for its icon. */
function mimeOf(name: string) {
  const extension = extensionOf(name);
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "image/";
  if (["mp4", "3gp"].includes(extension)) return "video/";
  if (["mp3", "ogg", "aac", "amr"].includes(extension)) return "audio/";
  return "application/";
}
function iconFor(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  return FileText;
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The broadcast's attachments, as the web's: up to 5 files of the API's types, 50 MB each, picked from the
 * phone's files, each with a remove button. A reopened draft's saved files come first and count toward the 5.
 * Files that don't fit are named in an error under the list.
 */
export function AttachmentPicker({
  files,
  onChange,
  saved = [],
  onSavedChange,
  disabled,
}: {
  files: OutgoingFile[];
  onChange: (files: OutgoingFile[]) => void;
  saved?: SavedFile[];
  onSavedChange?: (saved: SavedFile[]) => void;
  disabled?: boolean;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const count = saved.length + files.length;
  const full = count >= MAX_ATTACHMENTS;
  const rows = [
    ...saved.map((file) => ({
      key: `saved:${file.key}`,
      name: file.name,
      mimeType: mimeOf(file.name),
      size: undefined as number | undefined,
      remove: () => onSavedChange?.(saved.filter((other) => other !== file)),
    })),
    ...files.map((file, index) => ({
      key: `${file.name}:${file.size ?? index}`,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      remove: () => onChange(files.filter((other) => other !== file)),
    })),
  ];

  async function pick() {
    if (disabled || full) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ATTACHMENT_MIME_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const found: string[] = [];
    const picked = result.assets
      .filter((asset) => {
        if (!ATTACHMENT_EXTENSIONS.includes(extensionOf(asset.name))) {
          found.push(`${asset.name} isn't a file type broadcasts can send.`);
          return false;
        }
        if ((asset.size ?? 0) > MAX_BYTES) {
          found.push(`${asset.name} is over ${ATTACHMENT_MAX_MB} MB.`);
          return false;
        }
        // Already attached.
        return !files.some((file) => file.name === asset.name && file.size === asset.size);
      })
      .map((asset): OutgoingFile => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size,
        file: asset.file,
      }));
    const room = MAX_ATTACHMENTS - count;
    if (picked.length > room)
      found.push(
        `A broadcast can have up to ${MAX_ATTACHMENTS} attachments. The first ${room} were added.`,
      );
    setProblems(found);
    if (picked.length) onChange([...files, ...picked.slice(0, room)]);
  }

  return (
    <View className="gap-2">
      {rows.length > 0 && (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((file, index) => (
            <View
              key={file.key}
              className="min-h-14 flex-row items-center gap-3 border-border py-2 pl-3 pr-1"
              style={{ borderTopWidth: index === 0 ? 0 : 1 }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <CustomIcon as={iconFor(file.mimeType)} size={17} className="text-ink-700" />
              </View>
              <View className="min-w-0 flex-1">
                <CustomText numberOfLines={1} className="font-sans-medium text-sm">
                  {file.name}
                </CustomText>
                {!!file.size && (
                  <CustomText className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </CustomText>
                )}
              </View>
              <MotionPressable
                role="button"
                accessibilityLabel={`Remove ${file.name}`}
                disabled={disabled}
                onPress={() => {
                  setProblems([]);
                  file.remove();
                }}
                className="h-11 w-11 items-center justify-center rounded-full active:bg-accent"
              >
                <CustomIcon as={X} size={16} className="text-ink-600" />
              </MotionPressable>
            </View>
          ))}
        </View>
      )}
      {full ? (
        <CustomText className="text-[13px] leading-5 text-muted-foreground">
          {`This broadcast has the most attachments allowed (${MAX_ATTACHMENTS}). Remove one to add another.`}
        </CustomText>
      ) : (
        <MotionPressable
          role="button"
          accessibilityLabel="Add files"
          disabled={disabled}
          onPress={() => void pick()}
          className="min-h-14 flex-row items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-card px-3.5 py-3 active:bg-accent"
        >
          <CustomIcon as={Paperclip} size={18} className="text-primary" />
          <View className="min-w-0 flex-1 gap-0.5">
            <CustomText className="font-sans-semibold text-sm text-primary">Add files</CustomText>
            <CustomText className="text-xs leading-4 text-muted-foreground">
              {`Images, video, audio, PDF or Office files · up to ${MAX_ATTACHMENTS} files, ${ATTACHMENT_MAX_MB} MB each`}
            </CustomText>
          </View>
        </MotionPressable>
      )}
      {problems.map((problem) => (
        <CustomText key={problem} role="alert" className="text-xs text-error-fg">
          {problem}
        </CustomText>
      ))}
    </View>
  );
}
