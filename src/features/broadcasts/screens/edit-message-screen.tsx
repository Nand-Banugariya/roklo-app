import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomFormField } from "@/components/shadcn-custom/customformfield";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { KeyboardScreen } from "@/features/navigation/components/keyboard-screen";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { useAppDispatch } from "@/store/hooks";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { MessageEditor } from "../components/message-editor";
import { BODY_MAX } from "../constants";
import { loadBroadcastMessage, updateBroadcastMessage } from "../services/broadcasts-service";
import type { BroadcastStatus } from "../types";

/**
 * "Edit" on a scheduled, paused or sending broadcast: its message only, in the builder's editor. Audience, numbers,
 * schedule and files stay as they are.
 */
export function EditMessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const [saved, setSaved] = useState<{
    name: string;
    status: BroadcastStatus;
    content: string;
    files: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by "Try again".
  const [attempt, setAttempt] = useState(0);
  const [content, setContent] = useState("");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void dispatch(loadBroadcastMessage(id)).then((result) => {
      if (!current) return;
      if (!result.ok) {
        setLoadError(result.message || "Couldn't open this broadcast. Try again.");
        return;
      }
      setSaved(result.data);
      setContent(result.data.content);
    });
    return () => {
      current = false;
    };
  }, [dispatch, id, attempt]);

  // A file alone is a message too, as on the web.
  const issue =
    saved && !content.trim() && !saved.files ? "Write a message or attach a file." : null;

  async function save() {
    if (!saved || saving) return;
    setChecked(true);
    if (issue) return;
    if (content === saved.content) {
      router.back();
      return;
    }
    setSaving(true);
    setError(null);
    const result = await dispatch(updateBroadcastMessage(id, content));
    setSaving(false);
    if (!result.ok) {
      setError(result.message || "Couldn't save the message. Try again.");
      return;
    }
    router.back();
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Edit message" subtitle={saved?.name} />
      {!saved ? (
        <View className="flex-1 items-center justify-center gap-3 p-6">
          {loadError ? (
            <>
              <CustomText role="alert" className="text-center text-sm text-error-fg">
                {loadError}
              </CustomText>
              <CustomButton
                variant="link"
                onPress={() => {
                  setLoadError(null);
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </CustomButton>
            </>
          ) : (
            <CustomSpinner accessibilityLabel="Opening the message" />
          )}
        </View>
      ) : (
        <KeyboardScreen>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerClassName="gap-3 px-5 pb-10 pt-5"
          >
            <CustomFormField
              id="broadcast-message"
              label="Message"
              required
              size="lg"
              error={checked ? (issue ?? undefined) : undefined}
            >
              {(control) => (
                <MessageEditor
                  control={control}
                  value={content}
                  onChange={setContent}
                  maxLength={BODY_MAX}
                  invalid={checked && !!issue}
                  disabled={saving}
                />
              )}
            </CustomFormField>
            {(saved.status === "PAUSED" || saved.status === "RUNNING") && (
              <CustomText className="text-xs leading-5 text-muted-foreground">
                Only messages not sent yet get the new text.
              </CustomText>
            )}
          </ScrollView>
          <View className="gap-2 border-t border-ink-200 bg-card px-5 pb-4 pt-3">
            {error && (
              <CustomText role="alert" className="text-sm text-error-fg">
                {error}
              </CustomText>
            )}
            <CustomButton size="xl" fullWidth loading={saving} onPress={() => void save()}>
              Save message
            </CustomButton>
          </View>
        </KeyboardScreen>
      )}
    </View>
  );
}
