import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { cn } from "@/lib/utils";
import { Sparkles, Undo2 } from "lucide-react-native";
import { useEffect, useRef, type ComponentRef } from "react";
import { View } from "react-native";
import type { useAiRephrase } from "../hooks/use-ai-rephrase";
import { REPHRASE_TONES, type RephraseTone } from "../utils/ai-rephrase";

/** Compact tone choices, anchored outside the editor by ChatComposer. */
function AiRephraseControls({
  ai,
  open,
  onClose,
}: {
  ai: ReturnType<typeof useAiRephrase>;
  open: boolean;
  onClose: () => void;
}) {
  function choose(tone?: RephraseTone) {
    onClose();
    void ai.rephrase(tone);
  }
  if (!open || ai.busy) return null;
  return (
    <View className="overflow-hidden">
      <View className="flex-row items-center border-b border-ink-150">
        <MotionPressable
          role="button"
          accessibilityLabel="Rephrase as default"
          disabled={!ai.canRephrase}
          accessibilityState={{ disabled: !ai.canRephrase }}
          onPress={() => choose()}
          className={cn(
            "min-h-12 min-w-0 flex-1 flex-row items-center gap-3 px-5 active:bg-accent",
            !ai.canRephrase && "opacity-40",
          )}
        >
          <CustomIcon as={Sparkles} size={16} className="text-foreground" />
          <CustomText className="font-sans-medium text-sm">Rephrase</CustomText>
        </MotionPressable>
      </View>
      <View accessibilityLabel="Rephrase tone" className="gap-1.2 px-1 py-2">
        {REPHRASE_TONES.map(({ value, label }) => (
          <MotionPressable
            key={label}
            role="button"
            accessibilityLabel={`Rephrase as ${label.toLowerCase()}`}
            disabled={!ai.canRephrase}
            accessibilityState={{ disabled: !ai.canRephrase }}
            onPress={() => choose(value)}
            className={cn(
              "min-h-10 w-full justify-center rounded-lg px-4 active:bg-accent",
              !ai.canRephrase && "opacity-40",
            )}
          >
            <CustomText className="text-sm">{label}</CustomText>
          </MotionPressable>
        ))}
      </View>
    </View>
  );
}

/** Request feedback and Undo stay with the draft being reviewed. */
export function AiRephraseFeedback({ ai }: { ai: ReturnType<typeof useAiRephrase> }) {
  if (!ai.busy && !ai.error && !ai.rephrased) return null;
  return (
    <View className="px-3">
      {ai.busy && (
        <CustomText accessibilityLiveRegion="polite" className="py-3 text-xs text-muted-foreground">
          Rephrasing… Tap the AI icon to cancel.
        </CustomText>
      )}
      {ai.error && (
        <CustomText role="alert" className="py-3 text-xs leading-5 text-error-fg">
          {ai.error}
        </CustomText>
      )}
      {ai.rephrased && (
        <View className="pt-2">
          <CustomText
            accessibilityLiveRegion="polite"
            className="text-xs leading-5 text-muted-foreground"
          >
            Rephrased with AI. Review before sending.
          </CustomText>
          <View className="flex-row items-center gap-4">
            <MotionPressable
              role="button"
              accessibilityLabel="Undo AI rephrase"
              onPress={ai.undo}
              className="min-h-11 flex-row items-center gap-1.5"
            >
              <CustomIcon as={Undo2} size={14} className="text-primary" />
              <CustomText className="font-sans-medium text-xs text-primary">Undo</CustomText>
            </MotionPressable>
            <MotionPressable
              role="button"
              accessibilityLabel="Keep rephrased message"
              onPress={ai.keep}
              className="min-h-11 min-w-11 justify-center"
            >
              <CustomText className="font-sans-medium text-xs text-muted-foreground">
                Keep
              </CustomText>
            </MotionPressable>
          </View>
        </View>
      )}
    </View>
  );
}

/** Lives beside the attachment button, with the same touch target. */
export function AiRephraseButton({
  ai,
  open,
  onOpenChange,
}: {
  ai: ReturnType<typeof useAiRephrase>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trigger = useRef<ComponentRef<typeof PopoverTrigger>>(null);
  const viewport = useKeyboardViewport(open);
  useEffect(() => {
    if (!open) {
      trigger.current?.close();
      return;
    }
    // Re-measure after keyboard or window changes so the popup follows the icon.
    const frame = requestAnimationFrame(() => trigger.current?.open());
    return () => cancelAnimationFrame(frame);
  }, [open, viewport.width, viewport.windowHeight, viewport.top, viewport.bottom]);
  const disabled = !ai.busy && !ai.canRephrase;
  if (ai.busy)
    return (
      <MotionPressable
        role="button"
        accessibilityLabel="Cancel AI rephrase"
        onPress={ai.cancel}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-accent"
      >
        <CustomSpinner size="small" accessibilityLabel="Rephrasing message" />
      </MotionPressable>
    );
  return (
    <Popover onOpenChange={onOpenChange} className="h-11 w-11">
      <PopoverTrigger ref={trigger} asChild disabled={disabled}>
        <MotionPressable
          role="button"
          accessibilityLabel="AI Rephrase"
          accessibilityHint="Choose a tone to rewrite your draft for review"
          accessibilityState={{ expanded: open, disabled }}
          disabled={disabled}
          className={cn("h-11 w-11 items-center justify-center", disabled && "opacity-40")}
        >
          <View
            className={cn("h-7 w-7 items-center justify-center rounded-md", open && "bg-ink-100")}
          >
            <CustomIcon as={Sparkles} size={19} className="text-purple-accent" />
          </View>
        </MotionPressable>
      </PopoverTrigger>
      <PopoverContent
        accessibilityLabel="AI rephrase options"
        side="top"
        align="start"
        sideOffset={4}
        avoidCollisions
        insets={{
          top: viewport.top,
          bottom: viewport.bottom,
          left: 8,
          right: 8,
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-44 overflow-hidden rounded-xl border-ink-200 bg-card p-0 shadow-lg shadow-black/10"
      >
        <AiRephraseControls ai={ai} open={open} onClose={() => trigger.current?.close()} />
      </PopoverContent>
    </Popover>
  );
}
