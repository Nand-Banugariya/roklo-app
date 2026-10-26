import * as DocumentPicker from "expo-document-picker";
import { FileText, Keyboard as KeyboardIcon, Reply, Smile, Image as ImageIcon, Lock, Paperclip, SendHorizontal, X } from "lucide-react-native";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { BackHandler, Keyboard, TextInput, View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { useTypingHeartbeat } from "../hooks/use-typing-heartbeat";
import { useAiRephrase } from "../hooks/use-ai-rephrase";
import { AiRephraseButton, AiRephraseFeedback } from "./ai-rephrase-controls";
import { EmojiPanel } from "./emoji-panel";
import type { ChatMessage, Conversation, OutgoingFile } from "../types";
import { fillRephraseVariables } from "../utils/ai-rephrase";
import { messageSummary } from "../utils/message-actions";
import { plainWhatsAppText } from "../utils/whatsapp-text";

type Mode = "REPLY" | "PRIVATE_NOTE";
type Selection = { start: number; end: number };

// The web app's limits (lib/inbox/constants.ts): WhatsApp's own caps.
const MAX_MESSAGE_LENGTH = 4096;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/3gpp",
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "audio/mpeg", "audio/ogg", "audio/aac", "audio/amr",
];
/** WhatsApp's selection menu: each wraps the selected words in its marker, and unwraps them when already styled. */
const TOOLS: { label: string; mark: string; style: string }[] = [
  { label: "Bold", mark: "*", style: "font-sans-bold" },
  { label: "Italic", mark: "_", style: "italic" },
  { label: "Strikethrough", mark: "~", style: "line-through" },
  { label: "Monospace", mark: "```", style: "font-mono" },
];

export interface ComposerHandle { setDraft: (text: string) => void }
export interface ComposerSend { text: string; type: Mode; files: OutgoingFile[]; replyToMessageId?: string }
/** The message being replied to (quoted above the text), and who wrote it. */
export interface ComposerReply { message: ChatMessage; author: string }

/**
 * The reply box floating over the bottom of the thread, ported from the web app's Composer.
 * "Reply" sends on WhatsApp from the chat's number; "Private note" is team-only (amber, text only).
 * Return in the box adds a line; the Send button sends. `onSend` resolves false when sending failed,
 * and the draft comes back if nothing new was typed meanwhile.
 */
export function ChatComposer({ conversationId, conversation, canReply, canNote, onSend, replyTo = null, onCancelReply, ref }: {
  conversation: Conversation;
  replyTo?: ComposerReply | null;
  onCancelReply?: () => void;
  /** Where "typing…" is sent while a reply is being written. */
  conversationId: string;
  /** Replies need a live number that may send in this chat; notes only need the number. */
  canReply: boolean; canNote: boolean;
  onSend: (input: ComposerSend) => Promise<boolean>;
  ref?: Ref<ComposerHandle>;
}) {
  const { colors } = useRokloTheme();
  const [chosenMode, setMode] = useState<Mode>("REPLY");
  // A private note is answered with a note: it never reached WhatsApp.
  const replyingToNote = replyTo?.message.type === "PRIVATE_NOTE";
  const mode: Mode = canReply && !replyingToNote ? chosenMode : "PRIVATE_NOTE";
  const note = mode === "PRIVATE_NOTE";
  const [text, setText] = useState("");
  const [files, setFiles] = useState<OutgoingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | undefined>();
  const caret = useRef<Selection>({ start: 0, end: 0 });
  /** The selected words, for the style options (state: render can't read the caret ref). */
  const [range, setRange] = useState<Selection>({ start: 0, end: 0 });
  const hasSelection = range.start !== range.end;
  const input = useRef<TextInput>(null);
  /** WhatsApp's emoji panel, shown in the keyboard's place. */
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [rephraseOpen, setRephraseOpen] = useState(false);

  const enabled = note ? canNote : canReply;
  // The customer and teammates see "typing…" only while a WhatsApp reply is being written.
  const typing = useTypingHeartbeat(conversationId, !note && canReply);
  const body = text.trim();
  const canSend = enabled && (body.length > 0 || (!note && files.length > 0)) && body.length <= MAX_MESSAGE_LENGTH;
  function applyRewrite(value: string) {
    const end = value.length;
    caret.current = { start: end, end };
    setRange({ start: end, end });
    setSelection({ start: end, end });
    setText(value);
    input.current?.focus();
  }
  const ai = useAiRephrase({
    value: text, onValue: applyRewrite, enabled: canReply && !note,
    contextKey: `${conversationId}:${mode}`, maxLength: MAX_MESSAGE_LENGTH,
    transform: (rewrite) => fillRephraseVariables(rewrite, conversation),
  });
  const resetAi = ai.reset;
  useImperativeHandle(ref, () => ({ setDraft: (value) => { resetAi(); setText(value); input.current?.focus(); } }), [resetAi]);

  function switchMode(next: Mode) {
    // Switching starts empty: a half-typed reply never turns into a note, or back.
    if (next !== mode) { ai.reset(); setRephraseOpen(false); setText(""); setFiles([]); setError(null); }
    setMode(next);
    input.current?.focus();
  }
  /** The selected words already carry `mark` right around them. */
  function styledWith(mark: string, { start, end }: Selection) {
    return start >= mark.length && text.slice(start - mark.length, start) === mark && text.slice(end, end + mark.length) === mark;
  }
  function format(mark: string) {
    const { start, end } = caret.current;
    if (start === end) return;
    const on = styledWith(mark, { start, end });
    const next = on
      ? text.slice(0, start - mark.length) + text.slice(start, end) + text.slice(end + mark.length)
      : text.slice(0, start) + mark + text.slice(start, end) + mark + text.slice(end);
    if (next.length > MAX_MESSAGE_LENGTH) return;
    // The same words stay selected, so several styles can be stacked like on WhatsApp.
    const shift = on ? -mark.length : mark.length;
    const kept = { start: start + shift, end: end + shift };
    caret.current = kept;
    setRange(kept);
    ai.reset();
    setText(next);
    setSelection(kept);
    typing.onUserInput(next);
    input.current?.focus();
  }
  /** Puts `value` in place of the selection (or at the caret), with the caret after it. */
  function insertAtCaret(value: string) {
    const { start, end } = caret.current;
    const next = text.slice(0, start) + value + text.slice(end);
    if (next.length > MAX_MESSAGE_LENGTH) return;
    const at = start + value.length;
    caret.current = { start: at, end: at };
    ai.reset();
    setText(next);
    setSelection({ start: at, end: at });
    typing.onUserInput(next);
  }
  /** The panel's backspace: removes the selection, or the whole emoji or character before the caret. */
  function backspace() {
    const { start, end } = caret.current;
    if (start !== end) { removeRange(start, end); return; }
    if (start === 0) return;
    removeRange(start - lastSymbolLength(text.slice(0, start)), start);
  }
  function removeRange(from: number, to: number) {
    const next = text.slice(0, from) + text.slice(to);
    caret.current = { start: from, end: from };
    ai.reset();
    setText(next);
    setSelection({ start: from, end: from });
    typing.onUserInput(next);
  }
  function toggleEmoji() {
    if (emojiOpen) { setEmojiOpen(false); input.current?.focus(); return; }
    setRephraseOpen(false);
    Keyboard.dismiss();
    setEmojiOpen(true);
  }
  // Choosing Reply on a message puts the caret in the box.
  const replyId = replyTo?.message.id;
  useEffect(() => { if (replyId) input.current?.focus(); }, [replyId]);
  // Android's back closes composer controls before leaving the chat.
  useEffect(() => {
    if (!emojiOpen && !rephraseOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setEmojiOpen(false); setRephraseOpen(false); return true; });
    return () => subscription.remove();
  }, [emojiOpen, rephraseOpen]);

  async function attach() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_TYPES, multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    const problems: string[] = [];
    const picked = result.assets.filter((asset) => {
      if (asset.mimeType && !ALLOWED_TYPES.includes(asset.mimeType)) { problems.push(`${asset.name} can't be sent on WhatsApp.`); return false; }
      if ((asset.size ?? 0) > MAX_ATTACHMENT_BYTES) { problems.push(`${asset.name} is over 16 MB.`); return false; }
      return true;
    }).map((asset): OutgoingFile => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", size: asset.size, file: asset.file }));
    const next = [...files, ...picked];
    if (next.length > MAX_ATTACHMENTS) problems.push(`You can attach up to ${MAX_ATTACHMENTS} files.`);
    setFiles(next.slice(0, MAX_ATTACHMENTS));
    setError(problems[0] ?? null);
  }
  async function submit() {
    if (!canSend) return;
    ai.reset();
    setRephraseOpen(false);
    const sent = { text: body, type: mode, files: note ? [] : files, replyToMessageId: replyTo?.message.id };
    if (!note) typing.markSent();
    setText(""); setFiles([]); setError(null);
    if (await onSend(sent)) { onCancelReply?.(); return; }
    setText((draft) => draft || sent.text);
    setFiles((current) => current.length ? current : sent.files);
  }

  // WhatsApp's layout: one rounded box holding emoji, the text and attach on a single line, with the
  // round send button beside it. The Reply / Private note tabs and inline extras sit at the box's top.
  return <View>
    <View className="flex-row items-end gap-1.5">
    <View className={cn("min-w-0 flex-1 overflow-hidden rounded-[24px] border border-ink-250 shadow-lg shadow-black/15", note ? "bg-note-bg" : "bg-card")}>
    <View className="min-h-11 flex-row items-center border-b border-ink-150 pl-3 pr-1">
      {([["REPLY", "Reply"], ["PRIVATE_NOTE", "Private note"]] as const).map(([key, label]) => {
        const disabled = key === "REPLY" ? !canReply || replyingToNote : !canNote;
        return <MotionPressable key={key} role="tab" accessibilityLabel={label} aria-selected={mode === key}
          accessibilityState={{ selected: mode === key, disabled }} disabled={disabled} onPress={() => switchMode(key)}
          className={cn("-mb-px mr-4 min-h-11 justify-center border-b-2", mode === key ? "border-foreground" : "border-transparent")}>
          <CustomText className={cn("font-sans-medium text-[13px]", disabled ? "text-ink-400" : mode === key ? "text-foreground" : "text-muted-foreground")}>{label}</CustomText>
        </MotionPressable>;
      })}
    </View>

    {/* The quoted message, as WhatsApp shows it above a reply. */}
    {replyTo && <View className="flex-row items-stretch gap-2 px-2 pt-2">
      <View className="min-w-0 flex-1 gap-0.5 rounded-xl border-l-[3px] border-primary bg-ink-50 px-2.5 py-1.5">
        <View className="flex-row items-center gap-1">
          <CustomIcon as={Reply} size={12} className="text-brand-700" />
          <CustomText numberOfLines={1} className="shrink font-sans-semibold text-xs text-brand-700">Replying to {replyTo.author}</CustomText>
        </View>
        <CustomText numberOfLines={2} className="text-[13px] leading-[18px] text-ink-600">{plainWhatsAppText(messageSummary(replyTo.message))}</CustomText>
      </View>
      <MotionPressable role="button" accessibilityLabel="Cancel reply" onPress={() => { onCancelReply?.(); input.current?.focus(); }}
        className="h-11 w-9 items-center justify-center self-center"><CustomIcon as={X} size={16} className="text-ink-600" /></MotionPressable>
    </View>}
    {note && <View className="flex-row items-center gap-1.5 px-3 pt-2.5">
      <CustomIcon as={Lock} size={12} className="text-note-fg" />
      <CustomText className="text-xs text-note-fg">Visible to your team only</CustomText>
    </View>}
    {!note && files.length > 0 && <View className="flex-row flex-wrap gap-2 px-3 pt-2.5">
      {files.map((file, index) => {
        const media = file.mimeType.startsWith("image/") || file.mimeType.startsWith("video/");
        return <View key={`${file.uri}:${index}`} className="max-w-full flex-row items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-25 py-1.5 pl-2 pr-1">
          <View className={cn("h-8 w-8 items-center justify-center rounded-[7px]", media ? "bg-brand-100" : "bg-ink-100")}>
            <CustomIcon as={media ? ImageIcon : FileText} size={15} className={media ? "text-primary" : "text-ink-600"} />
          </View>
          <View className="min-w-0 shrink">
            <CustomText numberOfLines={1} className="font-sans-medium text-[13px]">{file.name}</CustomText>
            {file.size ? <CustomText className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</CustomText> : null}
          </View>
          <MotionPressable role="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => setFiles(files.filter((_, i) => i !== index))}
            className="h-11 w-9 items-center justify-center rounded-md active:bg-accent">
            <CustomIcon as={X} size={15} className="text-ink-600" />
          </MotionPressable>
        </View>;
      })}
    </View>}
    {error && <CustomText role="alert" className="px-3 pt-2 text-xs text-error-fg">{error}</CustomText>}
    {/* Selecting words brings up WhatsApp's styles, inline above the text (never a popup). */}
    {hasSelection && enabled && <View accessibilityLabel="Text style" className="flex-row flex-wrap items-center gap-1.5 px-2.5 pt-2">
      {TOOLS.map((tool) => {
        const on = styledWith(tool.mark, range);
        return <MotionPressable key={tool.label} role="button" accessibilityLabel={tool.label} accessibilityState={{ selected: on }}
          onPress={() => format(tool.mark)} className="min-h-11 justify-center">
          <View className={cn("rounded-full border px-3 py-1.5", on ? "border-primary bg-brand-100" : "border-ink-200 bg-ink-25")}>
            <CustomText className={cn("text-[13px]", tool.style, on ? "text-primary" : "text-foreground")}>{tool.label}</CustomText>
          </View>
        </MotionPressable>;
      })}
    </View>}

    {!note && <AiRephraseFeedback ai={ai} />}
    <View className="flex-row items-end px-1">
      <MotionPressable role="button" accessibilityLabel={emojiOpen ? "Show keyboard" : "Emoji"} accessibilityState={{ expanded: emojiOpen }}
        disabled={!enabled} onPress={toggleEmoji} className={cn("h-11 w-11 items-center justify-center rounded-full active:bg-accent", !enabled && "opacity-40")}>
        <CustomIcon as={emojiOpen ? KeyboardIcon : Smile} size={22} className={emojiOpen ? "text-primary" : "text-ink-600"} />
      </MotionPressable>
      <TextInput ref={input} accessibilityLabel={note ? "Private note" : "Reply"} multiline value={text} editable={enabled}
      maxLength={MAX_MESSAGE_LENGTH} selection={selection}
      onChangeText={(value) => { ai.reset(); setText(value); typing.onUserInput(value); }} onBlur={typing.onBlur}
      // Typing again brings the keyboard back in the panel's place.
      onFocus={() => setEmojiOpen(false)} showSoftInputOnFocus
      onSelectionChange={({ nativeEvent }) => {
        caret.current = nativeEvent.selection;
        setRange(nativeEvent.selection);
        if (selection) setSelection(undefined);
      }}
      placeholder={note ? "Only your team sees notes" : "Type a reply"} placeholderTextColor={colors["ink-500"]}
      className="max-h-32 min-h-11 min-w-0 flex-1 px-1 py-2.5 font-sans text-[15px] leading-[21px] text-foreground web:outline-none" />
      {!note && <AiRephraseButton ai={ai} open={rephraseOpen}
        onOpenChange={(next) => { if (next) setEmojiOpen(false); setRephraseOpen(next); }} />}
      {!note && <MotionPressable role="button" accessibilityLabel="Attach photos, videos or documents" disabled={!canReply}
        onPress={() => void attach()} className={cn("h-11 w-11 items-center justify-center rounded-full active:bg-accent", !canReply && "opacity-40")}>
        <CustomIcon as={Paperclip} size={20} className="-rotate-45 text-ink-600" />
      </MotionPressable>}
    </View>
    {body.length > MAX_MESSAGE_LENGTH - 200 && <CustomText className="px-4 pb-1.5 text-right text-[11px] text-muted-foreground">{body.length}/{MAX_MESSAGE_LENGTH}</CustomText>}
    </View>
    {/* WhatsApp's round send button, beside the box; amber for a private note. */}
    <MotionPressable role="button" accessibilityLabel={note ? "Save note" : "Send message"} accessibilityState={{ disabled: !canSend }}
      disabled={!canSend} onPress={() => void submit()}
      className={cn("mb-px h-12 w-12 items-center justify-center rounded-full shadow-md shadow-black/15",
        note ? (canSend ? "bg-[#f5b82e]" : "bg-[#f9d98c]") : canSend ? "bg-primary" : "bg-brand-200")}>
      <CustomIcon as={SendHorizontal} size={21} className={cn("ml-0.5", note ? "text-[#3d2a00]" : canSend ? "text-primary-foreground" : "text-brand-600")} />
    </MotionPressable>
  </View>
    {emojiOpen && enabled && <EmojiPanel onPick={insertAtCaret} onBackspace={backspace} />}
  </View>;
}

/**
 * Length of the last emoji or character, so one backspace removes ❤️, 👍🏽 or 👨‍👩‍👧 whole.
 * Hand-rolled: Hermes has no Intl.Segmenter.
 */
function lastSymbolLength(text: string) {
  const points = Array.from(text);
  const joiner = (point: string) => point === "\u200d";
  const modifier = (point: string) => point === "\ufe0f" || point === "\u20e3" || (point >= "\u{1f3fb}" && point <= "\u{1f3ff}");
  let length = 0;
  for (;;) {
    while (points.length && modifier(points[points.length - 1])) length += points.pop()!.length;
    if (!points.length) return length || 1;
    length += points.pop()!.length;
    if (!points.length || !joiner(points[points.length - 1])) return length;
    length += points.pop()!.length;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
