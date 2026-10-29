import {
  Bold,
  CalendarDays,
  Clock,
  CodeXml,
  Italic,
  List,
  ListOrdered,
  Mail,
  Plus,
  Quote,
  Smartphone,
  Sparkles,
  Strikethrough,
  Undo2,
  UserRound,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Fragment, useEffect, useRef, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import type { CustomFormControlProps } from "@/components/shadcn-custom/customformfield";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useAiRephrase } from "@/features/messaging/hooks/use-ai-rephrase";
import { REPHRASE_TONES, type RephraseTone } from "@/features/messaging/utils/ai-rephrase";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { cn } from "@/lib/utils";
import { MESSAGE_RISK, MESSAGE_VARIABLES } from "../constants";
import { useMessageRisk } from "../hooks/use-message-risk";
import { formatCount } from "../utils/broadcast-format";
import { applyEdits, formatText, insertVariable, type FormatAction } from "../utils/message-format";

/** The web toolbar's groups: inline styles, then line styles. */
const TOOLS: { action: FormatAction; label: string; icon: LucideIcon }[][] = [
  [
    { action: "bold", label: "Bold", icon: Bold },
    { action: "italic", label: "Italic", icon: Italic },
    { action: "strike", label: "Strikethrough", icon: Strikethrough },
  ],
  [
    { action: "bullet", label: "Bulleted list", icon: List },
    { action: "numbered", label: "Numbered list", icon: ListOrdered },
    { action: "quote", label: "Quote", icon: Quote },
    { action: "code", label: "Code", icon: CodeXml },
  ],
];
const VARIABLE_ICONS: Record<(typeof MESSAGE_VARIABLES)[number]["key"], LucideIcon> = {
  name: UserRound,
  firstName: UserRound,
  mobile: Smartphone,
  email: Mail,
  date: CalendarDays,
  time: Clock,
};
type Selection = { start: number; end: number };

/**
 * The broadcast's message box, as the web builder's: WhatsApp formatting toolbar and "Analyze with AI"
 * (spam risk, with AI Rephrase and Undo in its result), the text, then "Add variable" and the count.
 * Menus open inline (no popovers on signed-in screens).
 */
export function MessageEditor({
  value,
  onChange,
  maxLength,
  invalid,
  disabled,
  control,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  invalid?: boolean;
  disabled?: boolean;
  /** From `CustomFormField`: the input's id and accessibility wiring. */
  control: CustomFormControlProps;
}) {
  const { colors } = useRokloTheme();
  const input = useRef<TextInput>(null);
  const caret = useRef<Selection>({ start: value.length, end: value.length });
  // Set for one render after a toolbar edit, so the same words stay selected; the next native change clears it.
  const [selection, setSelection] = useState<Selection | undefined>();
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const ai = useAiRephrase({
    value,
    onValue: onChange,
    enabled: !disabled,
    contextKey: "broadcast",
    maxLength,
    // A broadcast keeps its {{variables}}: the API fills them in per contact.
    transform: (text) => text,
  });
  // Runs from "Analyze with AI" and after AI Rephrase or its Undo; an edit marks the result out of date.
  const analysis = useMessageRisk(value, ai.canRephrase);
  const { reanalyze } = analysis;
  const analyzeNext = useRef<"rewrite" | "original" | null>(null);
  useEffect(() => {
    const next = analyzeNext.current;
    if (!next || (next === "rewrite") !== ai.rephrased) return;
    analyzeNext.current = null;
    void reanalyze();
  }, [ai.rephrased, reanalyze]);
  useEffect(() => {
    if (ai.error) analyzeNext.current = null;
  }, [ai.error]);

  /** The new text with `next` selected, keeping the keyboard up. */
  function edit(text: string, next: Selection) {
    if (text.length > maxLength) return;
    caret.current = next;
    onChange(text);
    setSelection(next);
    input.current?.focus();
  }
  function format(action: FormatAction) {
    const { start, end } = caret.current;
    const result = formatText(value, start, end, action);
    if (!result.edits.length) return;
    edit(applyEdits(value, result.edits), { start: result.selection[0], end: result.selection[1] });
  }
  function addVariable(key: string) {
    const { start, end } = caret.current;
    const next = insertVariable(value, start, end, key);
    setVariablesOpen(false);
    edit(next.text, { start: next.caret, end: next.caret });
  }
  function rephrase(tone?: RephraseTone) {
    analyzeNext.current = "rewrite";
    void ai.rephrase(tone);
  }
  function undo() {
    analyzeNext.current = "original";
    ai.undo();
  }

  const busy = disabled || ai.busy;
  return (
    <View className="gap-2">
      <View
        className="overflow-hidden rounded-xl border bg-card"
        style={{ borderColor: invalid ? colors["error-solid"] : colors.input }}
      >
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          accessibilityRole="toolbar"
          accessibilityLabel="Formatting"
          className="border-b border-ink-150"
          contentContainerClassName="items-center px-1 py-1"
        >
          {TOOLS.map((group, index) => (
            <Fragment key={index}>
              {index > 0 && <Divider />}
              {group.map((tool) => (
                <MotionPressable
                  key={tool.action}
                  role="button"
                  accessibilityLabel={tool.label}
                  disabled={busy}
                  onPress={() => format(tool.action)}
                  className="h-10 w-10 items-center justify-center rounded-lg active:bg-accent"
                  style={{ opacity: busy ? 0.4 : 1 }}
                >
                  <CustomIcon as={tool.icon} size={18} className="text-ink-700" />
                </MotionPressable>
              ))}
            </Fragment>
          ))}
        </ScrollView>

        <TextInput
          ref={input}
          {...control}
          value={value}
          editable={!disabled}
          multiline
          scrollEnabled={false}
          maxLength={maxLength}
          textAlignVertical="top"
          placeholder="Write your message"
          placeholderTextColor={colors["ink-500"]}
          selection={selection}
          onChangeText={onChange}
          onSelectionChange={({ nativeEvent }) => {
            caret.current = nativeEvent.selection;
            if (selection) setSelection(undefined);
          }}
          className="min-h-[200px] px-3.5 py-3 font-sans text-[15px] leading-6 text-foreground web:outline-none"
        />

        <View className="flex-row items-center justify-between gap-2 border-t border-border bg-ink-50 px-1 py-1">
          <MotionPressable
            role="button"
            accessibilityLabel="Add variable"
            accessibilityState={{ expanded: variablesOpen }}
            disabled={disabled}
            onPress={() => setVariablesOpen((open) => !open)}
            className="h-10 flex-row items-center gap-1.5 rounded-lg px-2.5 active:bg-accent"
          >
            <CustomIcon as={Plus} size={16} className="text-primary" />
            <CustomText className="font-sans-semibold text-[13px] text-primary">
              Add variable
            </CustomText>
          </MotionPressable>
          <MotionPressable
            role="button"
            accessibilityLabel="Analyze with AI"
            accessibilityState={{
              disabled: !ai.canRephrase || !!disabled,
              busy: analysis.analyzing,
            }}
            disabled={!ai.canRephrase || disabled}
            onPress={() => {
              setAnalysisOpen(true);
              void reanalyze();
            }}
            className="h-10 flex-row items-center gap-1.5 rounded-lg px-2.5 active:bg-accent"
            style={{ opacity: !ai.canRephrase || disabled ? 0.4 : 1 }}
          >
            {analysis.analyzing ? (
              <CustomSpinner size="small" />
            ) : (
              <CustomIcon as={Sparkles} size={16} color={colors["purple-accent"]} />
            )}
            <CustomText className="font-sans-semibold text-[13px] text-purple-fg">
              {analysis.result || analysis.error || analysis.stale
                ? "Re-analyze"
                : "Analyze with AI"}
            </CustomText>
          </MotionPressable>
        </View>

        {/* The result opens under its button. */}
        {analysisOpen &&
          (analysis.analyzing || analysis.result || analysis.error || analysis.stale) && (
            <Analysis
              analysis={analysis}
              rephrasing={ai.busy}
              canRephrase={ai.canRephrase && !disabled}
              onRephrase={rephrase}
              onUndo={ai.rephrased ? undo : undefined}
              onClose={() => setAnalysisOpen(false)}
            />
          )}

        {variablesOpen && (
          <View className="border-t border-border pb-1.5">
            {["Contact", "Date & Time"].map((group) => (
              <View key={group}>
                <CustomText className="px-3.5 pb-1 pt-2.5 font-sans-semibold text-[11px] tracking-wider text-muted-foreground">
                  {group.toUpperCase()}
                </CustomText>
                {MESSAGE_VARIABLES.filter((variable) => variable.group === group).map(
                  (variable) => (
                    <MotionPressable
                      key={variable.key}
                      role="button"
                      accessibilityLabel={`Insert ${variable.label}`}
                      onPress={() => addVariable(variable.key)}
                      className="min-h-11 flex-row items-center gap-3 px-3.5 py-2 active:bg-accent"
                    >
                      <CustomIcon
                        as={VARIABLE_ICONS[variable.key]}
                        size={16}
                        className="text-ink-600"
                      />
                      <CustomText className="flex-1 text-[15px]">{variable.label}</CustomText>
                      <CustomText className="font-mono text-xs text-muted-foreground">{`{{${variable.key}}}`}</CustomText>
                    </MotionPressable>
                  ),
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <CustomText className="self-end text-xs text-muted-foreground">
        {formatCount(value.length)} / {formatCount(maxLength)}
      </CustomText>
      {/* Undo sits in the open result; closed, this keeps it reachable. */}
      {ai.rephrased && !analysisOpen && (
        <View className="flex-row items-center gap-2 rounded-xl bg-purple-tint px-3 py-1">
          <CustomIcon as={WandSparkles} size={15} color={colors["purple-accent"]} />
          <CustomText className="flex-1 text-[13px] text-purple-fg">Rewritten with AI</CustomText>
          <CustomButton size="sm" variant="ghost" onPress={undo}>
            Undo
          </CustomButton>
          <CustomButton size="sm" variant="ghost" onPress={ai.keep}>
            Keep
          </CustomButton>
        </View>
      )}
      {ai.error && (
        <CustomText role="alert" className="text-xs text-error-fg">
          {ai.error}
        </CustomText>
      )}
    </View>
  );
}

function Divider() {
  return <View className="mx-1 h-5 w-px bg-ink-200" />;
}

/**
 * The result of "Analyze with AI", under the toolbar: the risk and its meter, and AI Rephrase (default or by
 * tone, listed inline) when it isn't low.
 */
function Analysis({
  analysis,
  rephrasing,
  canRephrase,
  onRephrase,
  onUndo,
  onClose,
}: {
  analysis: ReturnType<typeof useMessageRisk>;
  rephrasing: boolean;
  canRephrase: boolean;
  onRephrase: (tone?: RephraseTone) => void;
  /** Set while the message is still the AI rewrite: brings the original back. */
  onUndo?: () => void;
  onClose: () => void;
}) {
  const { colors } = useRokloTheme();
  const [tonesOpen, setTonesOpen] = useState(false);
  const { result, error, analyzing } = analysis;
  const risk = result ? MESSAGE_RISK[result.level] : null;
  const low = result?.level === "low";
  const pick = (tone?: RephraseTone) => {
    setTonesOpen(false);
    onRephrase(tone);
  };

  return (
    <View
      accessibilityLabel="AI analysis"
      className="gap-2 border-t border-ink-150 bg-brand-50 px-3.5 py-2.5"
    >
      <View className="flex-row items-start gap-2">
        <View role="status" className="min-w-0 flex-1 gap-0.5">
          {risk && result ? (
            <>
              <CustomText className={cn("font-sans-semibold text-sm", risk.text)}>
                {low ? "No Risk" : risk.label}
              </CustomText>
              <CustomText className="text-[13px] leading-5 text-ink-600">
                {low ? "This message will get " : "This message is more likely to get "}
                <CustomText className="font-sans-semibold text-[13px] text-ink-900">
                  {low ? "successfully delivered." : "filtered or blocked."}
                </CustomText>
              </CustomText>
            </>
          ) : (
            <CustomText
              className={cn("text-[13px] leading-5", error ? "text-error-fg" : "text-ink-600")}
            >
              {error ??
                (analyzing
                  ? "Checking how this message reads…"
                  : "The message changed. Analyze it again to check the latest version.")}
            </CustomText>
          )}
        </View>
        {analyzing && <CustomSpinner size="small" accessibilityLabel="Checking the message" />}
        <MotionPressable
          role="button"
          accessibilityLabel="Close the analysis"
          onPress={onClose}
          hitSlop={6}
          className="-mr-1.5 -mt-1 h-8 w-8 items-center justify-center rounded-full active:bg-brand-100"
        >
          <CustomIcon as={X} size={16} className="text-ink-600" />
        </MotionPressable>
      </View>
      {risk && result && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Spam risk"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: result.score,
            text: low ? "No risk" : risk.label,
          }}
          className={cn("h-1.5 overflow-hidden rounded-full", risk.track)}
        >
          <View
            className={cn("h-full rounded-full", risk.bar)}
            style={{ width: `${Math.max(4, result.score)}%` }}
          />
        </View>
      )}
      {((result && !low) || onUndo) && (
        <View className="flex-row flex-wrap gap-2">
          {result && !low && (
            <CustomButton
              size="sm"
              variant="secondary"
              disabled={!canRephrase}
              loading={rephrasing}
              loadingText="Rephrasing"
              accessibilityState={{ expanded: tonesOpen }}
              onPress={() => setTonesOpen((open) => !open)}
              leadingIcon={
                <CustomIcon as={WandSparkles} size={14} color={colors["purple-accent"]} />
              }
            >
              AI Rephrase
            </CustomButton>
          )}
          {onUndo && (
            <CustomButton
              size="sm"
              variant="ghost"
              disabled={rephrasing}
              onPress={onUndo}
              leadingIcon={<CustomIcon as={Undo2} size={14} className="text-ink-700" />}
            >
              Undo
            </CustomButton>
          )}
        </View>
      )}
      {/* The web's menu: the default rephrase, then one per tone. */}
      {tonesOpen && !rephrasing && (
        <View className="flex-row flex-wrap gap-1.5">
          {[{ value: undefined, label: "Rephrase" }, ...REPHRASE_TONES].map((tone) => (
            <MotionPressable
              key={tone.label}
              role="button"
              accessibilityLabel={tone.value ? `Rephrase as ${tone.label}` : "Rephrase"}
              onPress={() => pick(tone.value)}
              className="min-h-9 justify-center rounded-full border border-brand-200 bg-card px-3 active:bg-accent"
            >
              <CustomText className="font-sans-medium text-[13px] text-foreground">
                {tone.label}
              </CustomText>
            </MotionPressable>
          ))}
        </View>
      )}
    </View>
  );
}
